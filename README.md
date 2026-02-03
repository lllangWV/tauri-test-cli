# tauri-driver-cli

CLI for testing Tauri applications with screenshot capture, DOM inspection, and user interaction simulation. Designed for use by AI agents (like Claude Code) to automate testing of Tauri desktop apps.

## Quick Start

```bash
# Install globally
npm install -g tauri-driver-cli

# Install tauri-driver (required)
tauri-driver setup

# Check dependencies
tauri-driver check-deps

# Start server and test your app
tauri-driver server --app ./target/debug/my-app &
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'
```

## Installation

### Global Install via npm

```bash
npm install -g tauri-driver-cli
# or
bun install -g tauri-driver-cli
# or
pnpm install -g tauri-driver-cli

# Then install tauri-driver
tauri-driver setup
```

### Using Pixi (Recommended for Development)

Pixi handles all system-level dependencies automatically (WebKit, GTK, Rust).

```bash
# Clone and install
git clone https://github.com/lllangWV/tauri-driver-cli
cd tauri-driver-cli
pixi install

# Build the CLI
pixi run build

# Run commands via pixi
pixi run dev server --app ./target/debug/my-app
```

### Prerequisites

The CLI will check for missing dependencies and provide install instructions:

```bash
tauri-driver check-deps
```

<details>
<summary>Manual prerequisite installation</summary>

#### Linux

```bash
# WebKit (required)
sudo apt install libwebkit2gtk-4.1-dev    # Debian/Ubuntu
sudo dnf install webkit2gtk4.1-devel       # Fedora
sudo pacman -S webkit2gtk-4.1              # Arch

# Rust and tauri-driver
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
tauri-driver setup
```

#### macOS

WebKit is included in macOS. Just install tauri-driver:

```bash
tauri-driver setup
```

#### Windows

WebView2 is included in Windows 10/11. Just install tauri-driver:

```bash
tauri-driver setup
```

</details>

## Usage

### Server Mode (Recommended)

Start a persistent HTTP server - send commands anytime via HTTP.

```bash
# Start server
tauri-driver server --app ./target/debug/my-app &

# Send commands
curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot"}'

# Check status
curl -s http://127.0.0.1:9222/status

# Stop server
tauri-driver stop
```

#### Virtual Display Mode (Linux)

Run in a virtual display to avoid focus-related throttling:

```bash
# Using built-in --xvfb flag (recommended)
tauri-driver server --app ./target/debug/my-app --xvfb &

# Or manually with Xvfb
Xvfb :99 -screen 0 1920x1080x24 &
DISPLAY=:99 tauri-driver server --app ./target/debug/my-app &
```

### Why Server Mode?

- **No startup delay**: App stays running between commands
- **Simple HTTP API**: Works with `curl`, `fetch`, or any HTTP client
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
| `tauri-driver setup` | Install tauri-driver via cargo |
| `tauri-driver stop [--port]` | Stop a running server |
| `tauri-driver cleanup` | Kill stale WebDriver processes |
| `tauri-driver check-deps` | Check system dependencies |

### Examples

```bash
# Click a button
curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button.submit"}'

# Type into an input
curl -s http://127.0.0.1:9222 -d '{"cmd":"type","selector":"input[name=email]","text":"user@example.com"}'

# Take screenshot
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'

# Get DOM snapshot (accessibility tree in YAML format)
curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot","output":"/tmp/dom.yaml"}'

# Execute JavaScript
curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"document.title"}'

# Wait for element to disappear
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
]' | tauri-driver batch --app ./target/debug/my-app --json
```

## Single Commands

Each command starts a fresh session (slower but simpler):

```bash
tauri-driver screenshot --app ./target/debug/my-app --output /tmp/screen.png
tauri-driver click "button#submit" --app ./target/debug/my-app
tauri-driver snapshot --app ./target/debug/my-app
```

## Using with Claude Code

This CLI is designed for AI agents. Add this to your project's CLAUDE.md:

```markdown
## Testing Tauri Apps

Use `tauri-driver` CLI for testing the Tauri application.

### Start test server
tauri-driver server --app ./target/debug/my-app --xvfb &

### Available commands via HTTP POST to http://127.0.0.1:9222
- Click: {"cmd":"click","selector":"button"}
- Type: {"cmd":"type","selector":"input","text":"hello"}
- Screenshot: {"cmd":"screenshot","output":"/tmp/screen.png"}
- Snapshot: {"cmd":"snapshot"}
- Eval: {"cmd":"eval","script":"document.title"}
- Wait: {"cmd":"wait","selector":".element"}

### Stop server
tauri-driver stop
```

## Troubleshooting

### "Maximum number of active sessions" Error

```bash
tauri-driver cleanup
```

### Server won't start

```bash
tauri-driver stop
tauri-driver cleanup
```

### Missing dependencies

```bash
tauri-driver check-deps
tauri-driver setup  # Install tauri-driver
```

### Window focus issues (slow commands)

Use the `--xvfb` flag to run in a virtual display:

```bash
tauri-driver server --app ./target/debug/my-app --xvfb &
```

## CLI Reference

```
tauri-driver - CLI for testing Tauri applications

USAGE:
  tauri-driver <command> --app <path-to-tauri-binary> [options]

COMMANDS:
  server [--port <port>] [--xvfb]   Start HTTP server for persistent sessions
  screenshot [--output <path>]      Take a screenshot
  snapshot [--output <path>]        Get DOM/accessibility tree snapshot
  click <selector>                  Click an element
  type <selector> <text>            Type text into an element
  wait <selector>                   Wait for an element
  eval <script>                     Execute JavaScript
  batch                             Execute multiple commands from stdin
  stop [--port <port>]              Stop a running server
  cleanup                           Kill stale WebDriver processes
  setup                             Install tauri-driver via cargo
  check-deps                        Check system dependencies

OPTIONS:
  --app <path>      Path to Tauri app binary
  --port <port>     Port for server mode (default: 9222)
  --xvfb            Run server in virtual display (Linux)
  --json            Output results as JSON
  --help, -h        Show help
```

## License

MIT
