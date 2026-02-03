#!/usr/bin/env bun
import { connect, disconnect } from "./driver.js";
import { screenshot } from "./commands/screenshot.js";
import { snapshot } from "./commands/snapshot.js";
import { click } from "./commands/click.js";
import { type as typeText } from "./commands/type.js";
import { waitFor } from "./commands/wait.js";
import { evaluate } from "./commands/eval.js";
import { startServer } from "./server.js";
import { ensureDependencies, printDependencyStatus } from "./checks.js";
import { setup, stopServer, cleanup, checkXvfb, buildXvfbCommand } from "./commands/utils.js";

const HELP = `
tauri-driver - CLI for testing Tauri applications

USAGE:
  tauri-driver <command> --app <path-to-tauri-binary> [options]

COMMANDS:
  server [--port <port>] [--xvfb]
      Start HTTP server for persistent sessions (RECOMMENDED FOR AGENTS)
      Keeps app running, accepts commands via HTTP POST
      Use --xvfb to run in virtual display (Linux, avoids focus issues)

  screenshot [--output <path>] [--full-page]
      Take a screenshot of the app window

  snapshot [--output <path>]
      Get DOM/accessibility tree snapshot (YAML format)

  click <selector>
      Click an element by CSS selector

  type <selector> <text>
      Type text into an element

  wait <selector> [--timeout <ms>] [--gone]
      Wait for an element to appear (or disappear with --gone)

  eval <script>
      Execute JavaScript in the app context

  batch
      Execute multiple commands in a single session (reads JSON from stdin)

  stop [--port <port>]
      Stop a running tauri-driver server

  cleanup
      Kill stale WebDriver processes (tauri-driver, WebKitWebDriver, Xvfb)

  setup
      Install tauri-driver via cargo

  check-deps
      Check if all required system dependencies are installed

  help
      Show this help message

OPTIONS:
  --app <path>      Path to Tauri app binary (REQUIRED for most commands)
  --wait <ms>       How long to wait for app to load (default: 15000)
  --port <port>     Port for server mode (default: 9222)
  --xvfb            Run server in virtual display (Linux only)
  --json            Output results as JSON
  --no-auto-wait    Disable auto-wait behavior (not recommended)
  --help, -h        Show help

SERVER MODE (Recommended for Agents):
  Start a persistent HTTP server - no batching needed!
  Commands execute instantly (no auto-wait by default for speed).

  # 1. Start server (runs in foreground, use & for background)
  tauri-driver server --app /path/to/your/tauri-app --port 9222 &

  # 2. Send commands anytime via curl - executes instantly!
  curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button"}'
  curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/x.png"}'
  curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot"}'

  # 3. Check status
  curl -s http://127.0.0.1:9222/status

  # 4. Stop server
  curl -s http://127.0.0.1:9222/stop

  Use --auto-wait flag to enable DOM stability waiting (slower but safer).

AUTO-WAIT BEHAVIOR (batch mode only by default):
  In batch mode, commands automatically wait for DOM stability.
  In server mode, auto-wait is OFF by default for speed.

  Add explicit waits if needed:
  curl -s http://127.0.0.1:9222 -d '{"cmd":"wait","selector":".element","timeout":3000}'

EXAMPLES:
  # First-time setup
  tauri-driver setup                    # Install tauri-driver via cargo
  tauri-driver check-deps               # Verify all dependencies

  # Server mode (best for agents)
  tauri-driver server --app ./target/debug/my-tauri-app &
  curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button"}'
  curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/result.png"}'

  # Server in virtual display (Linux - avoids focus/throttling issues)
  tauri-driver server --app ./target/debug/my-tauri-app --xvfb &

  # Stop server and cleanup
  tauri-driver stop                     # Stop server on default port
  tauri-driver stop --port 8080         # Stop server on custom port
  tauri-driver cleanup                  # Kill stale WebDriver processes

  # Batch mode (single invocation)
  echo '[{"cmd":"click","selector":"button"},{"cmd":"screenshot","output":"/tmp/result.png"}]' | tauri-driver batch --app ./target/debug/my-tauri-app --json

  # Single commands
  tauri-driver screenshot --app ./target/debug/my-tauri-app --output /tmp/screen.png
  tauri-driver click "button#submit" --app ./target/debug/my-tauri-app
`;

interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: string[] = [];
  const options: Record<string, string | boolean> = {};
  let command = "";

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (next && !next.startsWith("--")) {
        options[key] = next;
        i += 2;
      } else {
        options[key] = true;
        i++;
      }
    } else if (arg.startsWith("-")) {
      options[arg.slice(1)] = true;
      i++;
    } else if (!command) {
      command = arg;
      i++;
    } else {
      args.push(arg);
      i++;
    }
  }

  return { command, args, options };
}

// Batch command structure
interface BatchCommand {
  cmd: string;
  selector?: string;
  text?: string;
  script?: string;
  output?: string;
  fullPage?: boolean;
  timeout?: number;
  gone?: boolean;
  ms?: number;
  autoWait?: boolean; // Override auto-wait for this command
}

interface BatchResult {
  index: number;
  cmd: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Execute a single command and return the result
 */
async function executeCommand(cmd: BatchCommand, globalAutoWait: boolean): Promise<unknown> {
  // Use command-specific autoWait if provided, otherwise use global setting
  const autoWait = cmd.autoWait ?? globalAutoWait;

  switch (cmd.cmd) {
    case "screenshot":
      return await screenshot({
        output: cmd.output,
        fullPage: cmd.fullPage,
        autoWait,
      });

    case "snapshot":
      return await snapshot({
        output: cmd.output,
        autoWait,
      });

    case "click":
      if (!cmd.selector) {
        throw new Error("click requires a selector");
      }
      return await click(cmd.selector, {
        autoWait,
        timeout: cmd.timeout,
      });

    case "type":
      if (!cmd.selector || cmd.text === undefined) {
        throw new Error("type requires selector and text");
      }
      return await typeText(cmd.selector, cmd.text, {
        autoWait,
        timeout: cmd.timeout,
      });

    case "wait":
      if (!cmd.selector) {
        throw new Error("wait requires a selector");
      }
      return await waitFor(cmd.selector, {
        timeout: cmd.timeout ?? 5000,
        gone: cmd.gone ?? false,
      });

    case "eval":
      if (!cmd.script) {
        throw new Error("eval requires a script");
      }
      return await evaluate(cmd.script);

    case "sleep":
      await new Promise((resolve) => setTimeout(resolve, cmd.ms ?? 1000));
      return { slept: cmd.ms ?? 1000 };

    default:
      throw new Error(`Unknown command: ${cmd.cmd}`);
  }
}

/**
 * Execute batch commands from JSON input
 */
async function executeBatch(commands: BatchCommand[], globalAutoWait: boolean): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    try {
      const result = await executeCommand(cmd, globalAutoWait);
      results.push({
        index: i,
        cmd: cmd.cmd,
        success: true,
        result,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        index: i,
        cmd: cmd.cmd,
        success: false,
        error,
      });
      // Continue to next command even on error (agent can handle partial success)
    }
  }

  return results;
}

/**
 * Read all stdin input
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  const { command, args, options } = parseArgs(process.argv.slice(2));

  if (options.help || options.h || command === "help" || !command) {
    console.log(HELP);
    process.exit(0);
  }

  // Check dependencies command
  if (command === "check-deps") {
    printDependencyStatus();
    const missing = ensureDependencies(false);
    process.exit(missing ? 0 : 1);
  }

  // Setup command - install tauri-driver (doesn't require deps check first)
  if (command === "setup") {
    const result = await setup();
    process.exit(result.success ? 0 : 1);
  }

  // Stop command - stop running server (doesn't require app path)
  if (command === "stop") {
    const port = options.port ? parseInt(options.port as string) : 9222;
    const result = await stopServer(port);
    process.exit(result.success ? 0 : 1);
  }

  // Cleanup command - kill stale processes (doesn't require app path)
  if (command === "cleanup") {
    const result = await cleanup();
    process.exit(result.success ? 0 : 1);
  }

  // Verify dependencies before running any command that needs them
  ensureDependencies();

  // App path is required
  const appPath = options.app as string;
  if (!appPath) {
    console.error("Error: --app <path> is required. Specify the path to your Tauri app binary.");
    console.error("");
    console.error("Example:");
    console.error("  tauri-driver server --app ./target/debug/my-app");
    console.error("  tauri-driver screenshot --app ./target/debug/my-app --output /tmp/screen.png");
    process.exit(1);
  }
  const waitTimeout = options.wait ? parseInt(options.wait as string) : 15000;
  const jsonOutput = !!options.json;
  const autoWait = !options["no-auto-wait"]; // Default to true
  const port = options.port ? parseInt(options.port as string) : 9222;

  // Server mode - special handling, doesn't follow normal flow
  // Server mode defaults to autoWait=false for speed (no WebDriver throttling issues)
  // User can enable with --auto-wait flag
  if (command === "server") {
    const serverAutoWait = !!options["auto-wait"]; // Default false in server mode
    const useXvfb = !!options["xvfb"];

    // If --xvfb flag is set, re-run ourselves wrapped in xvfb-run
    if (useXvfb) {
      if (process.platform === "win32") {
        console.error("Error: --xvfb is not supported on Windows");
        process.exit(1);
      }

      if (!checkXvfb()) {
        console.error("Error: xvfb-run not found. Install with:");
        console.error("  sudo apt install xvfb  # Debian/Ubuntu");
        console.error("  sudo dnf install xorg-x11-server-Xvfb  # Fedora");
        process.exit(1);
      }

      // Build the command without --xvfb to avoid infinite loop
      const args = process.argv.slice(2).filter((arg) => arg !== "--xvfb");
      const xvfbArgs = buildXvfbCommand([process.argv[0], process.argv[1], ...args]);

      console.error("Starting server in virtual display (xvfb)...");
      console.error(`Running: ${xvfbArgs.join(" ")}`);

      const proc = Bun.spawn(xvfbArgs, {
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      // Wait for the process to exit
      const exitCode = await proc.exited;
      process.exit(exitCode);
    }

    try {
      await startServer({ port, appPath, waitTimeout, autoWait: serverAutoWait });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
    return;
  }

  try {
    // Connect to the app (waits for page load)
    console.error(`Launching app and waiting for load (timeout: ${waitTimeout}ms)...`);
    await connect({ appPath, waitTimeout });

    let result: unknown;

    switch (command) {
      case "batch": {
        // Read commands from stdin
        const input = await readStdin();
        let commands: BatchCommand[];
        try {
          commands = JSON.parse(input);
          if (!Array.isArray(commands)) {
            throw new Error("Batch input must be a JSON array");
          }
        } catch (err) {
          console.error("Error: Invalid JSON input for batch mode");
          console.error("Expected format: [{\"cmd\":\"click\",\"selector\":\"button\"}, ...]");
          process.exit(1);
        }

        console.error(`Executing ${commands.length} commands (autoWait: ${autoWait})...`);
        result = await executeBatch(commands, autoWait);

        // Check if all commands succeeded
        const batchResults = result as BatchResult[];
        const failures = batchResults.filter((r) => !r.success);
        if (failures.length > 0) {
          console.error(`${failures.length}/${commands.length} commands failed`);
        } else {
          console.error(`All ${commands.length} commands succeeded`);
        }
        break;
      }

      case "screenshot":
        result = await screenshot({
          output: options.output as string,
          fullPage: !!options["full-page"],
          autoWait,
        });
        break;

      case "snapshot":
        result = await snapshot({
          output: options.output as string,
          autoWait,
        });
        break;

      case "click":
        if (!args[0]) {
          console.error("Error: click requires a selector");
          process.exit(1);
        }
        result = await click(args[0], { autoWait });
        break;

      case "type":
        if (!args[0] || !args[1]) {
          console.error("Error: type requires <selector> <text>");
          process.exit(1);
        }
        result = await typeText(args[0], args[1], { autoWait });
        break;

      case "wait":
        if (!args[0]) {
          console.error("Error: wait requires a selector");
          process.exit(1);
        }
        result = await waitFor(args[0], {
          timeout: options.timeout ? parseInt(options.timeout as string) : 5000,
          gone: !!options.gone,
        });
        break;

      case "eval":
        if (!args[0]) {
          console.error("Error: eval requires a script");
          process.exit(1);
        }
        result = await evaluate(args[0]);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }

    // Output result
    if (result !== undefined) {
      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else if (typeof result === "string") {
        console.log(result);
      } else if (result !== null) {
        console.log(JSON.stringify(result, null, 2));
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jsonOutput) {
      console.log(JSON.stringify({ error: message }));
    } else {
      console.error(`Error: ${message}`);
    }
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
