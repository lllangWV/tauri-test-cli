import { spawn, execSync, type ChildProcess } from "child_process";
import { remote, type Browser } from "webdriverio";
import { homedir } from "os";
import { join } from "path";

let driverProcess: ChildProcess | null = null;
let browser: Browser | null = null;
let exitHandlerRegistered = false;

const DRIVER_PORT = 4444;
const DRIVER_HOST = "127.0.0.1";

/**
 * Recursively find all descendant PIDs of a given PID.
 */
function getDescendantPids(pid: number): number[] {
  try {
    // pgrep -P finds direct children; recurse for full tree
    const children = execSync(`pgrep -P ${pid} 2>/dev/null`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number);
    const descendants: number[] = [];
    for (const child of children) {
      descendants.push(child, ...getDescendantPids(child));
    }
    return descendants;
  } catch {
    return [];
  }
}

/**
 * Kill a process and all its descendants.
 */
function killProcessTree(pid: number, signal: NodeJS.Signals = "SIGKILL"): void {
  const descendants = getDescendantPids(pid);
  // Kill children first (bottom-up), then the parent
  for (const child of descendants.reverse()) {
    try { process.kill(child, signal); } catch {}
  }
  try { process.kill(pid, signal); } catch {}
}

/**
 * Force-kill the driver process tree.
 * Called on process exit to prevent orphaned app windows.
 */
export function forceKillDriver(): void {
  if (driverProcess?.pid) {
    killProcessTree(driverProcess.pid);
    driverProcess = null;
  }
}

export interface DriverOptions {
  appPath: string;
  headless?: boolean;
  waitTimeout?: number; // How long to wait for page load (ms), default 15000
}

/**
 * Kill any stale process listening on the driver port and its descendants.
 * Prevents "Maximum number of active sessions" from orphaned tauri-driver.
 * Also kills orphaned WebKitWebDriver on adjacent port.
 */
function killStaleDriver(): void {
  let killed = false;
  // Kill processes on both the driver port and the WebKitWebDriver port (driver + 1)
  for (const port of [DRIVER_PORT, DRIVER_PORT + 1]) {
    try {
      const pids = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (pids) {
        for (const pidStr of pids.split("\n")) {
          const pid = parseInt(pidStr);
          if (pid) { killProcessTree(pid); killed = true; }
        }
      }
    } catch {
      // No process on port, or lsof not available
    }
  }
  if (killed) {
    // Allow ports to be released
    execSync("sleep 0.5");
  }
}

/**
 * Start tauri-driver process
 */
export async function startDriver(): Promise<void> {
  if (driverProcess) {
    return;
  }

  killStaleDriver();

  const tauriDriverPath = join(homedir(), ".cargo", "bin", "tauri-driver");

  return new Promise((resolve, reject) => {
    // Wrap tauri-driver in a shell (via setsid for its own process group) that monitors stdin.
    // When our process dies (any reason including SIGKILL), the stdin pipe breaks,
    // `read` returns EOF, the shell exits, and the EXIT trap kills the whole group.
    // setsid gives the shell its own session/group so `kill 0` doesn't affect the caller.
    driverProcess = spawn("setsid", [
      "sh", "-c",
      `"${tauriDriverPath}" & PID=$!; trap "kill 0 2>/dev/null" EXIT; read; exit`,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Register exit handler once to kill orphaned processes
    if (!exitHandlerRegistered) {
      exitHandlerRegistered = true;
      process.on("exit", forceKillDriver);
    }

    driverProcess.on("error", (err) => {
      reject(new Error(`Failed to start tauri-driver: ${err.message}`));
    });

    // Wait for driver to be ready
    let output = "";
    driverProcess.stdout?.on("data", (data) => {
      output += data.toString();
      // tauri-driver prints listening message when ready
      if (output.includes("Listening")) {
        resolve();
      }
    });

    driverProcess.stderr?.on("data", (data) => {
      const msg = data.toString();
      // Some startup messages go to stderr
      if (msg.includes("Listening")) {
        resolve();
      }
    });

    // Fallback: assume ready after short delay
    setTimeout(() => resolve(), 1000);
  });
}

/**
 * Stop tauri-driver process
 */
export function stopDriver(): void {
  if (driverProcess?.pid) {
    killProcessTree(driverProcess.pid);
    driverProcess = null;
  }
}

/**
 * Wait for the page to be fully loaded
 */
async function waitForPageLoad(browser: Browser, timeout = 10000): Promise<void> {
  const start = Date.now();

  // Wait for document.readyState to be 'complete'
  while (Date.now() - start < timeout) {
    try {
      const readyState = await browser.execute(() => document.readyState);
      if (readyState === "complete") {
        // Additional wait for any async rendering (Svelte, etc.)
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if body has meaningful content (not just loading state)
        const bodyLength = await browser.execute(() => document.body.innerHTML.length);
        if (bodyLength > 100) {
          return;
        }
      }
    } catch {
      // Page might be navigating, retry
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Final fallback wait
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Connect to the Tauri app via WebDriver
 */
export async function connect(options: DriverOptions): Promise<Browser> {
  if (browser) {
    return browser;
  }

  await startDriver();

  browser = await remote({
    hostname: DRIVER_HOST,
    port: DRIVER_PORT,
    capabilities: {
      "tauri:options": {
        application: options.appPath,
      },
    } as any,
  });

  // Wait for the app to fully load
  await waitForPageLoad(browser, options.waitTimeout ?? 15000);

  return browser;
}

/**
 * Get current browser instance
 */
export function getBrowser(): Browser | null {
  return browser;
}

/**
 * Disconnect and cleanup
 */
export async function disconnect(): Promise<void> {
  if (browser) {
    await browser.deleteSession();
    browser = null;
  }
  stopDriver();
}

/**
 * Ensure we have a connected browser, throw if not
 */
export function requireBrowser(): Browser {
  if (!browser) {
    throw new Error("Not connected. Run 'tauri-test-cli connect' first.");
  }
  return browser;
}

/**
 * Wait for DOM to stabilize (no structural mutations for settleTime ms)
 * Returns early if DOM is already stable or timeout is reached
 *
 * Strategy:
 * - Only watch for STRUCTURAL changes (elements added/removed, text content)
 * - IGNORE attribute changes (hover states, class toggles, style changes)
 * - Wait a short initial window (30ms) to see if any mutations occur
 * - If no mutations: DOM is stable, return immediately
 * - If mutations detected: wait until settleTime (100ms) of no changes
 */
export async function waitForDomStable(
  options: { settleTime?: number; timeout?: number } = {}
): Promise<void> {
  const browser = requireBrowser();
  const settleTime = options.settleTime ?? 100;
  const timeout = options.timeout ?? 2000;

  // Use executeAsync for proper Promise handling in browser context
  await browser.executeAsync(
    (settleTime: number, timeout: number, done: (result?: unknown) => void) => {
      let mutationDetected = false;
      let settleTimer: ReturnType<typeof setTimeout> | null = null;

      const observer = new MutationObserver((mutations) => {
        // Only count structural changes, not attribute changes (hover, focus, etc.)
        const hasStructuralChange = mutations.some(
          (m) => m.type === "childList" || m.type === "characterData"
        );

        if (!hasStructuralChange) {
          return; // Ignore attribute-only changes (hover states, etc.)
        }

        mutationDetected = true;
        // Reset settle timer on each structural mutation
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          observer.disconnect();
          done();
        }, settleTime);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false, // Don't watch attributes (hover, class changes)
        characterData: true,
      });

      // Initial check: wait 30ms to see if any mutations occur
      // If no mutations, DOM is already stable - return early
      setTimeout(() => {
        if (!mutationDetected) {
          observer.disconnect();
          if (settleTimer) clearTimeout(settleTimer);
          done();
        }
      }, 30);

      // Absolute timeout fallback
      setTimeout(() => {
        observer.disconnect();
        if (settleTimer) clearTimeout(settleTimer);
        done();
      }, timeout);
    },
    settleTime,
    timeout
  );
}

/**
 * Wait for element to be interactive (visible and not disabled)
 */
export async function waitForInteractive(
  selector: string,
  timeout = 5000
): Promise<void> {
  const browser = requireBrowser();
  const element = await browser.$(selector);

  await element.waitForDisplayed({ timeout });
  await element.waitForClickable({ timeout });
}
