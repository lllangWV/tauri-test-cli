# tauri-test-cli

CLI for testing Tauri applications with screenshot capture, DOM inspection, and user interaction simulation. Designed for use by AI agents (like Claude Code) to automate testing of Tauri desktop apps.

## Installation

### Using Pixi (Recommended)

Pixi handles all system-level dependencies automatically (WebKit, Rust, Bun).

```bash
# Clone and install
git clone https://github.com/lllangWV/tauri-test-cli
cd tauri-test-cli
pixi install

# Install tauri-driver (one-time setup)
pixi run install-tauri-driver

# Build the CLI
pixi run build
```

### Global Install via npm

If you already have the prerequisites installed:

```bash
npm install -g tauri-test-cli
# or
bun install -g tauri-test-cli
```

### Prerequisites (if not using pixi)

<details>
<summary>Manual prerequisite installation</summary>

#### 1. Install WebKitWebDriver (Linux)

```bash
sudo apt-get install webkit2gtk-driver
```

#### 2. Install tauri-driver

```bash
cargo install tauri-driver --locked
```

#### 3. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

</details>

## Build Your Tauri App

Your Tauri app must be built before testing:

```bash
cd your-tauri-project
cargo build  # or: cargo tauri build
```

## Usage

All commands require `--app <path>` to specify your Tauri app binary.

### Server Mode (Recommended for Agents)

Start a persistent HTTP server - send commands anytime via HTTP.

```bash
# 1. Start server (runs in foreground, use & for background)
# With pixi:
pixi run dev server --app ./target/debug/my-app --port 9222 &

# Or if installed globally:
tauri-test server --app ./target/debug/my-app --port 9222 &

# 2. Send commands via curl (or any HTTP client)
curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"button"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/result.png"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"type","selector":"input","text":"hello"}'

# 3. Check status
curl -s http://127.0.0.1:9222/status

# 4. Stop server when done
curl -s http://127.0.0.1:9222/stop
```

### Why Server Mode?

- **No startup delay**: App stays running between commands
- **No batching required**: Send commands one at a time, asynchronously
- **Simple HTTP API**: Works with `curl`, `fetch`, or any HTTP client
- **Instant execution**: No auto-wait delay by default

Use `--auto-wait` flag if you want DOM stability waiting (can be slower when window unfocused).

### Server Response Format

```json
{"success": true, "result": {"path": "/tmp/screen.png", "width": 1280, "height": 720}}
```

On error:
```json
{"success": false, "error": "Element not found: .missing"}
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Execute a command (JSON body) |
| `/status` | GET | Check if server is running |
| `/stop` | GET/POST | Shutdown the server |

## Command Reference

| Command | Required Fields | Optional Fields |
|---------|----------------|-----------------|
| `click` | `selector` | `timeout` |
| `type` | `selector`, `text` | `timeout` |
| `screenshot` | - | `output`, `fullPage` |
| `snapshot` | - | `output` |
| `eval` | `script` | - |
| `wait` | `selector` | `timeout`, `gone` |

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
curl -s http://127.0.0.1:9222 -d '{"cmd":"wait","selector":".modal","gone":true}'
```

## Auto-Wait Behavior

Commands automatically wait for the right conditions:

- **click/type**: Wait for element to be interactive, then wait for DOM to stabilize
- **screenshot/snapshot**: Wait for DOM to stabilize before capturing

**In server mode**: Auto-wait is OFF by default for speed. Use `--auto-wait` to enable.
**In batch/single mode**: Auto-wait is ON by default. Use `--no-auto-wait` to disable.

## Batch Mode

For single-invocation workflows with multiple commands:

```bash
echo '[
  {"cmd":"click","selector":"button"},
  {"cmd":"screenshot","output":"/tmp/result.png"}
]' | pixi run dev batch --app ./target/debug/my-app --json
```

## Single Commands

Each command starts a fresh session (slower but simpler):

```bash
pixi run dev screenshot --app ./target/debug/my-app --output /tmp/screen.png
pixi run dev click "button#submit" --app ./target/debug/my-app
pixi run dev snapshot --app ./target/debug/my-app
```

## Using with Claude Code

This CLI is designed to be used by AI agents. To give Claude Code access:

1. Clone tauri-test-cli into your project or install globally
2. Tell Claude about it in your project's CLAUDE.md:

```markdown
# Testing Tauri Apps

Use `tauri-test` CLI for testing the Tauri application.

## Setup (one-time)
cd /path/to/tauri-test-cli && pixi install && pixi run install-tauri-driver && pixi run build

## Start test server
pixi run -m /path/to/tauri-test-cli dev server --app ./target/debug/my-app --port 9222 &

## Available commands via HTTP POST to http://127.0.0.1:9222
- Click: {"cmd":"click","selector":"button"}
- Type: {"cmd":"type","selector":"input","text":"hello"}
- Screenshot: {"cmd":"screenshot","output":"/tmp/screen.png"}
- Snapshot: {"cmd":"snapshot"}
- Eval: {"cmd":"eval","script":"document.title"}
- Wait: {"cmd":"wait","selector":".element"}

## Check status / Stop server
curl -s http://127.0.0.1:9222/status
curl -s http://127.0.0.1:9222/stop
```

## Troubleshooting

### "Maximum number of active sessions" Error

Kill stale WebDriver processes:

```bash
pkill -f tauri-driver
pkill -f WebKitWebDriver
```

### Server won't start

Make sure no other instance is running:

```bash
curl -s http://127.0.0.1:9222/stop 2>/dev/null || true
pkill -f tauri-driver
```

### Window focus issues (slow commands)

Run in a virtual display to avoid focus-related throttling:

```bash
Xvfb :99 -screen 0 1280x720x24 &
DISPLAY=:99 tauri-test server --app ./target/debug/my-app &
```

## License

MIT
