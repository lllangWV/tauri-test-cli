import { execSync, spawn } from "child_process";
import os from "os";

// ANSI color codes
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const dim = "\x1b[2m";

/**
 * Install tauri-driver via cargo
 */
export async function setup(): Promise<{ success: boolean; message: string }> {
  console.log(`${bold}Installing tauri-driver...${reset}`);
  console.log(`${dim}Running: cargo install tauri-driver --locked${reset}`);
  console.log();

  try {
    // Check if cargo is available
    try {
      execSync("cargo --version", { stdio: "ignore" });
    } catch {
      return {
        success: false,
        message: "cargo not found. Please install Rust first: https://rustup.rs",
      };
    }

    // Run cargo install
    const result = Bun.spawnSync(["cargo", "install", "tauri-driver", "--locked"], {
      stdout: "inherit",
      stderr: "inherit",
    });

    if (result.exitCode === 0) {
      console.log();
      console.log(`${green}${bold}✓ tauri-driver installed successfully${reset}`);
      return { success: true, message: "tauri-driver installed successfully" };
    } else {
      return {
        success: false,
        message: `cargo install failed with exit code ${result.exitCode}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

/**
 * Stop a running tauri-driver server
 */
export async function stopServer(port: number): Promise<{ success: boolean; message: string }> {
  const url = `http://127.0.0.1:${port}/stop`;

  try {
    const response = await fetch(url, { method: "POST" });

    if (response.ok) {
      const data = await response.json();
      console.log(`${green}✓ Server stopped${reset}`);
      return { success: true, message: "Server stopped" };
    } else {
      return {
        success: false,
        message: `Server returned status ${response.status}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Check if it's a connection error (server not running)
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("Connection refused") ||
      message.includes("Unable to connect")
    ) {
      console.log(`${yellow}Server not running on port ${port}${reset}`);
      return { success: true, message: "Server not running" };
    }

    console.error(`${red}Error: ${message}${reset}`);
    return { success: false, message };
  }
}

/**
 * Clean up stale WebDriver processes
 */
export async function cleanup(): Promise<{ success: boolean; killed: string[] }> {
  const killed: string[] = [];
  const platform = os.platform();

  // Processes to kill
  const processPatterns = [
    "tauri-driver",
    "WebKitWebDriver",
    "Xvfb",
  ];

  console.log(`${bold}Cleaning up stale processes...${reset}`);
  console.log();

  if (platform === "win32") {
    // Windows: use taskkill
    for (const pattern of processPatterns) {
      try {
        execSync(`taskkill /F /IM ${pattern}.exe 2>nul`, { stdio: "ignore" });
        killed.push(pattern);
        console.log(`  ${green}✓${reset} Killed ${pattern}`);
      } catch {
        console.log(`  ${dim}- ${pattern} not running${reset}`);
      }
    }
  } else {
    // Unix: use pkill
    for (const pattern of processPatterns) {
      try {
        execSync(`pkill -f "${pattern}"`, { stdio: "ignore" });
        killed.push(pattern);
        console.log(`  ${green}✓${reset} Killed ${pattern}`);
      } catch {
        // pkill returns non-zero if no processes matched
        console.log(`  ${dim}- ${pattern} not running${reset}`);
      }
    }
  }

  console.log();

  if (killed.length > 0) {
    console.log(`${green}Cleaned up ${killed.length} process(es)${reset}`);
  } else {
    console.log(`${dim}No stale processes found${reset}`);
  }

  return { success: true, killed };
}

/**
 * Check if Xvfb is available
 */
export function checkXvfb(): boolean {
  if (os.platform() === "win32") {
    return false;
  }

  try {
    execSync("which Xvfb", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find an available display number
 */
function findAvailableDisplay(): number {
  // Start from :99 and work up to find an unused display
  for (let display = 99; display < 200; display++) {
    const lockFile = `/tmp/.X${display}-lock`;
    const socketFile = `/tmp/.X11-unix/X${display}`;
    try {
      // Check if lock file or socket exists
      execSync(`test -e ${lockFile} || test -e ${socketFile}`, { stdio: "ignore" });
      // Files exist, display is in use
    } catch {
      // Files don't exist, display is available
      return display;
    }
  }
  return 99; // Fallback
}

/**
 * Wait for X display to be ready
 */
async function waitForDisplay(display: number, timeoutMs: number = 10000): Promise<boolean> {
  const displayStr = `:${display}`;
  const startTime = Date.now();
  const pollInterval = 100; // ms

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Try to query the display with xdpyinfo
      execSync(`DISPLAY=${displayStr} xdpyinfo`, { stdio: "ignore", timeout: 1000 });
      return true;
    } catch {
      // Display not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
  return false;
}

let xvfbProcess: ReturnType<typeof spawn> | null = null;
let xvfbDisplay: number | null = null;

/**
 * Start Xvfb and wait for it to be ready
 * Returns the display number (e.g., 99 for :99)
 */
export async function startXvfb(): Promise<number> {
  const display = findAvailableDisplay();
  const displayStr = `:${display}`;

  console.error(`Starting Xvfb on display ${displayStr}...`);

  // Start Xvfb with the display number
  xvfbProcess = spawn("Xvfb", [
    displayStr,
    "-screen", "0", "1920x1080x24",
    "-ac", // Disable access control (allows any client to connect)
  ], {
    stdio: "ignore",
    detached: false,
  });

  xvfbProcess.on("error", (err) => {
    console.error(`Xvfb error: ${err.message}`);
  });

  xvfbProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Xvfb exited with code ${code}`);
    }
    xvfbProcess = null;
  });

  // Wait for the display to be ready
  const ready = await waitForDisplay(display);
  if (!ready) {
    stopXvfb();
    throw new Error(`Xvfb display ${displayStr} failed to start within timeout`);
  }

  console.error(`Xvfb ready on display ${displayStr}`);
  xvfbDisplay = display;

  // Set DISPLAY environment variable for this process
  process.env.DISPLAY = displayStr;

  // Force X11 backend so GTK/WebKit uses Xvfb instead of the real Wayland session
  delete process.env.WAYLAND_DISPLAY;
  process.env.GDK_BACKEND = "x11";

  return display;
}

/**
 * Stop the Xvfb process if running
 */
export function stopXvfb(): void {
  if (xvfbProcess) {
    console.error("Stopping Xvfb...");
    xvfbProcess.kill("SIGTERM");
    xvfbProcess = null;
    xvfbDisplay = null;
  }
}

/**
 * Get the current Xvfb display number
 */
export function getXvfbDisplay(): number | null {
  return xvfbDisplay;
}
