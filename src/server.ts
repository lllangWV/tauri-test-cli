import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { connect, disconnect, getBrowser } from "./driver.js";
import { screenshot } from "./commands/screenshot.js";
import { snapshot } from "./commands/snapshot.js";
import { click } from "./commands/click.js";
import { type as typeText } from "./commands/type.js";
import { waitFor } from "./commands/wait.js";
import { evaluate } from "./commands/eval.js";

/**
 * Activate the window to prevent WebDriver throttling
 * Uses WebDriver protocol directly (faster than browser.execute)
 */
async function activateWindow(): Promise<void> {
  const browser = getBrowser();
  if (!browser) return;

  try {
    // Get current window handle and switch to it (activates window)
    const handle = await browser.getWindowHandle();
    await browser.switchToWindow(handle);
  } catch {
    // Ignore activation errors
  }
}

interface Command {
  cmd: string;
  selector?: string;
  text?: string;
  script?: string;
  output?: string;
  fullPage?: boolean;
  timeout?: number;
  gone?: boolean;
  ms?: number;
  autoWait?: boolean;
}

interface ServerOptions {
  port: number;
  appPath: string;
  waitTimeout: number;
  autoWait: boolean; // Note: Server mode defaults to false for speed
}

let serverInstance: ReturnType<typeof createServer> | null = null;
let isShuttingDown = false;

/**
 * Execute a single command
 */
async function executeCommand(cmd: Command, globalAutoWait: boolean): Promise<unknown> {
  const autoWait = cmd.autoWait ?? globalAutoWait;
  const startTime = Date.now();

  // Log timing for debugging
  console.error(`[${new Date().toISOString()}] Starting command: ${cmd.cmd}`);

  // Activate window before each command to prevent throttling
  const activateStart = Date.now();
  await activateWindow();
  console.error(`[${new Date().toISOString()}] activateWindow took ${Date.now() - activateStart}ms`);

  const cmdStart = Date.now();
  let result: unknown;

  switch (cmd.cmd) {
    case "screenshot":
      result = await screenshot({
        output: cmd.output,
        fullPage: cmd.fullPage,
        autoWait,
      });
      break;

    case "snapshot":
      result = await snapshot({
        output: cmd.output,
        autoWait,
      });
      break;

    case "click":
      if (!cmd.selector) {
        throw new Error("click requires a selector");
      }
      result = await click(cmd.selector, {
        autoWait,
        timeout: cmd.timeout,
      });
      break;

    case "type":
      if (!cmd.selector || cmd.text === undefined) {
        throw new Error("type requires selector and text");
      }
      result = await typeText(cmd.selector, cmd.text, {
        autoWait,
        timeout: cmd.timeout,
      });
      break;

    case "wait":
      if (!cmd.selector) {
        throw new Error("wait requires a selector");
      }
      result = await waitFor(cmd.selector, {
        timeout: cmd.timeout ?? 5000,
        gone: cmd.gone ?? false,
      });
      break;

    case "eval":
      if (!cmd.script) {
        throw new Error("eval requires a script");
      }
      result = await evaluate(cmd.script);
      break;

    case "sleep":
      await new Promise((resolve) => setTimeout(resolve, cmd.ms ?? 1000));
      result = { slept: cmd.ms ?? 1000 };
      break;

    case "status":
      result = { status: "running", message: "Server is running" };
      break;

    default:
      throw new Error(`Unknown command: ${cmd.cmd}`);
  }

  console.error(`[${new Date().toISOString()}] Command ${cmd.cmd} took ${Date.now() - cmdStart}ms (total: ${Date.now() - startTime}ms)`);
  return result;
}

/**
 * Read request body
 */
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Handle incoming HTTP request
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  autoWait: boolean
): Promise<void> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = req.url || "/";

  // GET /status - health check
  if (req.method === "GET" && url === "/status") {
    sendJson(res, 200, { status: "running" });
    return;
  }

  // GET /stop or POST /stop - shutdown server
  if (url === "/stop") {
    sendJson(res, 200, { status: "stopping", message: "Server shutting down" });
    shutdown();
    return;
  }

  // POST / - execute command
  if (req.method === "POST" && (url === "/" || url === "/cmd")) {
    try {
      const body = await readBody(req);
      let cmd: Command;

      try {
        cmd = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }

      if (!cmd.cmd) {
        sendJson(res, 400, { error: "Missing 'cmd' field" });
        return;
      }

      const result = await executeCommand(cmd, autoWait);
      sendJson(res, 200, { success: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { success: false, error: message });
    }
    return;
  }

  // Unknown route
  sendJson(res, 404, {
    error: "Not found",
    usage: {
      "POST /": "Execute a command",
      "GET /status": "Check server status",
      "GET /stop": "Stop the server",
    },
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error("Shutting down...");

  if (serverInstance) {
    serverInstance.close();
  }

  try {
    await disconnect();
  } catch {
    // Ignore disconnect errors during shutdown
  }

  process.exit(0);
}

/**
 * Inject a keep-alive mechanism to prevent WebKit background throttling
 */
async function injectKeepAlive(): Promise<void> {
  const browser = getBrowser();
  if (!browser) return;

  try {
    await browser.execute(() => {
      // Create an audio context to prevent throttling (browsers don't throttle audio)
      // This is a common workaround for background tab throttling
      if (!(window as any).__keepAliveAudio) {
        try {
          const audioCtx = new AudioContext();
          const oscillator = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          gain.gain.value = 0; // Silent
          oscillator.connect(gain);
          gain.connect(audioCtx.destination);
          oscillator.start();
          (window as any).__keepAliveAudio = { audioCtx, oscillator, gain };
          console.log("[tauri-driver] Keep-alive audio context created");
        } catch (e) {
          console.warn("[tauri-driver] Could not create keep-alive audio context:", e);
        }
      }
    });
    console.error("Keep-alive mechanism injected.");
  } catch (err) {
    console.error("Warning: Could not inject keep-alive:", err);
  }
}

/**
 * Start the HTTP server
 */
export async function startServer(options: ServerOptions): Promise<void> {
  const { port, appPath, waitTimeout, autoWait } = options;

  // Handle shutdown signals
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Connect to the app first
  console.error(`Launching app and waiting for load (timeout: ${waitTimeout}ms)...`);
  await connect({ appPath, waitTimeout });
  console.error("App loaded successfully.");

  // Inject keep-alive to prevent background throttling
  await injectKeepAlive();

  // Create HTTP server
  serverInstance = createServer((req, res) => {
    handleRequest(req, res, autoWait).catch((err) => {
      console.error("Request error:", err);
      sendJson(res, 500, { error: "Internal server error" });
    });
  });

  serverInstance.listen(port, "127.0.0.1", () => {
    console.error(`Server listening on http://127.0.0.1:${port}`);
    console.error("");
    console.error("Usage:");
    console.error(`  curl -s http://127.0.0.1:${port} -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'`);
    console.error(`  curl -s http://127.0.0.1:${port} -d '{"cmd":"click","selector":"button"}'`);
    console.error(`  curl -s http://127.0.0.1:${port} -d '{"cmd":"snapshot"}'`);
    console.error(`  curl -s http://127.0.0.1:${port}/status`);
    console.error(`  curl -s http://127.0.0.1:${port}/stop`);
    console.error("");
    // Output machine-readable ready signal
    console.log(JSON.stringify({ status: "ready", port, url: `http://127.0.0.1:${port}` }));
  });

  // Keep the server running
  await new Promise(() => {});
}
