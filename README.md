# tauri-test-cli

CLI for testing Tauri applications with screenshot capture, DOM inspection, and user interaction simulation. Designed for use by AI agents (like Claude Code) to automate testing of Tauri desktop apps.

## Quick Start

```bash
# Install globally
npm install -g tauri-test-cli

# Install tauri-test (required)
tauri-test setup

# Check dependencies
tauri-test check-deps

# Start server and test your app
tauri-test server --app ./target/debug/my-app &
tauri-test screenshot --output /tmp/screen.png
tauri-test click "button.submit"
```

## Installation

### Global Install via npm

```bash
npm install -g tauri-test-cli
# or
bun install -g tauri-test-cli
# or
pnpm install -g tauri-test-cli

# Then install tauri-test
tauri-test setup
```

### Using Pixi (Recommended for Development)

Pixi handles all system-level dependencies automatically (WebKit, GTK, Rust).

```bash
# Clone and install
git clone https://github.com/lllangWV/tauri-test-cli
cd tauri-test-cli
pixi install

# Build the CLI
pixi run build

# Run commands via pixi
pixi run dev server --app ./target/debug/my-app
```

### Prerequisites

The CLI will check for missing dependencies and provide install instructions:

```bash
tauri-test check-deps
```

<details>
<summary>Manual prerequisite installation</summary>

#### Linux

```bash
# WebKit (required)
sudo apt install libwebkit2gtk-4.1-dev    # Debian/Ubuntu
sudo dnf install webkit2gtk4.1-devel       # Fedora
sudo pacman -S webkit2gtk-4.1              # Arch

# Rust and tauri-test
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
tauri-test setup
```

#### macOS

WebKit is included in macOS. Just install tauri-test:

```bash
tauri-test setup
```

#### Windows

WebView2 is included in Windows 10/11. Just install tauri-test:

```bash
tauri-test setup
```

</details>

## Usage

### Server Mode (Recommended)

Start a persistent HTTP server - send commands anytime via HTTP.

```bash
# Start server
tauri-test server --app ./target/debug/my-app &

# Send commands
curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot"}'

# Check status
curl -s http://127.0.0.1:9222/status

# Stop server
tauri-test stop
```

#### Virtual Display Mode (Linux)

Run in a virtual display to avoid focus-related throttling:

```bash
# Using built-in --xvfb flag (recommended)
tauri-test server --app ./target/debug/my-app --xvfb &

# Or manually with Xvfb
Xvfb :99 -screen 0 1920x1080x24 &
DISPLAY=:99 tauri-test server --app ./target/debug/my-app &
```

### Client Mode (CLI without --app)

Once the server is running, you can use CLI commands directly - no `--app` needed, no curl required:

```bash
# Start server once
tauri-test server --app ./target/debug/my-app &

# Run commands - they automatically connect to the server!
tauri-test click "button.submit"
tauri-test type "input[name=email]" "user@example.com"
tauri-test screenshot --output /tmp/screen.png
tauri-test snapshot --output /tmp/dom.yaml
tauri-test eval "document.title"
tauri-test wait ".modal" --gone --timeout 5000

# Check server status
tauri-test status

# Stop when done
tauri-test stop
```

Use `--port` to connect to a different server:

```bash
tauri-test click "button" --port 8080
```

### Why Server Mode?

- **No startup delay**: App stays running between commands
- **Simple CLI or HTTP API**: Use CLI commands or `curl`/`fetch`
- **Instant execution**: No auto-wait delay by default

## Commands

### Testing Commands

| Command | Required Fields | Optional Fields |
|---------|----------------|-----------------|
| `click` | `selector` | `timeout` |
| `type` | `selector`, `text` | `timeout` |
| `screenshot` | - | `output`, `fullPage` |
| `snapshot` | - | `output` |
| `eval` | `script` | - |
| `wait` | `selector` | `timeout`, `gone` |

### Utility Commands

| Command | Description |
|---------|-------------|
| `tauri-test setup` | Install tauri-test via cargo |
| `tauri-test status [--port]` | Check if a server is running |
| `tauri-test stop [--port]` | Stop a running server |
| `tauri-test cleanup` | Kill stale WebDriver processes |
| `tauri-test check-deps` | Check system dependencies |

### Examples

**Using CLI (recommended):**

```bash
# Click a button
tauri-test click "button.submit"

# Type into an input
tauri-test type "input[name=email]" "user@example.com"

# Take screenshot
tauri-test screenshot --output /tmp/screen.png

# Get DOM snapshot (accessibility tree in YAML format)
tauri-test snapshot --output /tmp/dom.yaml

# Execute JavaScript
tauri-test eval "document.title"

# Wait for element to disappear
tauri-test wait ".modal" --gone --timeout 5000
```

**Using curl:**

```bash
curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button.submit"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"type","selector":"input[name=email]","text":"user@example.com"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot","output":"/tmp/dom.yaml"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"document.title"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"wait","selector":".modal","gone":true,"timeout":5000}'
```

### Server Response Format

```json
{"success": true, "result": {"path": "/tmp/screen.png", "width": 1280, "height": 720}}
```

On error:
```json
{"success": false, "error": "Element not found: .missing"}
```

## Batch Mode

For single-invocation workflows with multiple commands:

```bash
echo '[
  {"cmd":"click","selector":"button"},
  {"cmd":"screenshot","output":"/tmp/result.png"}
]' | tauri-test batch --app ./target/debug/my-app --json
```

## Single Commands

Each command starts a fresh session (slower but simpler):

```bash
tauri-test screenshot --app ./target/debug/my-app --output /tmp/screen.png
tauri-test click "button#submit" --app ./target/debug/my-app
tauri-test snapshot --app ./target/debug/my-app
```

## Using with Claude Code

This CLI is designed for AI agents. Add this to your project's CLAUDE.md:

```markdown
## Testing Tauri Apps

Use `tauri-test` CLI for testing the Tauri application.

### Start test server
tauri-test server --app ./target/debug/my-app --xvfb &

### Available commands (once server is running, no --app needed)
- Click: `tauri-test click "button"`
- Type: `tauri-test type "input" "hello"`
- Screenshot: `tauri-test screenshot --output /tmp/screen.png`
- Snapshot: `tauri-test snapshot --output /tmp/dom.yaml`
- Eval: `tauri-test eval "document.title"`
- Wait: `tauri-test wait ".element" --timeout 5000`

### Check server status
tauri-test status

### Stop server
tauri-test stop
```

## Development

### Setup

```bash
# Clone and install dependencies
git clone https://github.com/lllangWV/tauri-test-cli
cd tauri-test-cli
pixi install

# Build the CLI
pixi run build

# Build the test app (required for integration tests)
pixi run test-app-build
```

### Running Tests

```bash
# Run all tests (builds test app automatically)
pixi run test-all

# Run only unit tests (fast, no test app needed)
pixi run test-unit

# Run only integration tests (requires test app)
pixi run test-integration

# Watch mode for development
pixi run test-watch
```

### Test Structure

| Test File | Description | Count |
|-----------|-------------|-------|
| `src/cli.test.ts` | Arg parsing, batch command validation | 50 |
| `src/checks.test.ts` | Dependency checking | 20 |
| `src/commands/utils.test.ts` | Utility functions | 6 |
| `src/integration.test.ts` | End-to-end tests against test app | 30 |

### Test App

A minimal Tauri test app is included in `apps/test-app/` for integration testing:

```bash
# Build the test app
pixi run test-app-build

# Run the test app manually
pixi run test-app-run

# Start tauri-test server with test app
pixi run test-server
```

### Available Pixi Tasks

```bash
pixi task list   # Show all available tasks
```

Key development tasks:
- `pixi run build` - Build the CLI
- `pixi run dev` - Run CLI in development mode
- `pixi run typecheck` - Run TypeScript type checking
- `pixi run test-all` - Run all tests
- `pixi run test-server` - Start server with test app

### Benchmarks (Claude Code Headless Testing)

Run Claude Code in headless mode to test the CLI and measure performance:

```bash
# List available benchmark tasks
pixi run benchmark-list

# Run a single benchmark with visualization
pixi run benchmark -v screenshot

# Run all benchmarks
pixi run benchmark-all

# Run all benchmarks quietly (timing only)
pixi run benchmark-all-quiet

# Run with different models
pixi run benchmark-opus      # Claude Opus
pixi run benchmark-haiku     # Claude Haiku
MODEL=sonnet pixi run benchmark-all  # Explicit model
```

#### Available Benchmark Tasks

| Task | Description |
|------|-------------|
| `screenshot` | Take a screenshot |
| `click` | Click a button and verify |
| `type` | Type text into input |
| `snapshot` | Get DOM snapshot |
| `eval` | Execute JavaScript |
| `wait` | Wait for elements |
| `form-fill` | Fill and submit form |
| `full-workflow` | Complete end-to-end test |

#### Benchmark Results

Results are saved to `benchmarks/results/` with:
- Individual task JSON files with timing and token usage
- Summary JSON with all results from a run

Example output:
```json
{
  "task": "screenshot",
  "model": "sonnet",
  "status": "passed",
  "duration_seconds": 12.5,
  "tokens": {
    "input": 1234,
    "output": 567,
    "cache_read": 890,
    "cache_create": 0
  }
}
```

## Troubleshooting

### "Maximum number of active sessions" Error

```bash
tauri-test cleanup
```

### Server won't start

```bash
tauri-test stop
tauri-test cleanup
```

### Missing dependencies

```bash
tauri-test check-deps
tauri-test setup  # Install tauri-test
```

### Window focus issues (slow commands)

Use the `--xvfb` flag to run in a virtual display:

```bash
tauri-test server --app ./target/debug/my-app --xvfb &
```

## CLI Reference

```
tauri-test - CLI for testing Tauri applications

USAGE:
  tauri-test <command> [options]

  When --app is omitted, commands connect to a running server (client mode).

COMMANDS:
  server [--port <port>] [--xvfb]   Start HTTP server for persistent sessions
  screenshot [--output <path>]      Take a screenshot
  snapshot [--output <path>]        Get DOM/accessibility tree snapshot
  click <selector>                  Click an element
  type <selector> <text>            Type text into an element
  wait <selector>                   Wait for an element
  eval <script>                     Execute JavaScript
  batch                             Execute multiple commands from stdin
  status [--port <port>]            Check if a server is running
  stop [--port <port>]              Stop a running server
  cleanup                           Kill stale WebDriver processes
  setup                             Install tauri-test via cargo
  check-deps                        Check system dependencies

OPTIONS:
  --app <path>      Path to Tauri app binary (required for server/batch)
  --port <port>     Port for server/client mode (default: 9222)
  --xvfb            Run server in virtual display (Linux)
  --json            Output results as JSON
  --help, -h        Show help
```

## License

MIT
