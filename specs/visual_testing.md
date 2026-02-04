# Visual Testing with tauri-driver-cli

Use `tauri-driver-cli` to visually test the Tauri app via WebDriver.

## Quick Start

```bash
# 1. Start frontend dev server
pixi run frontend-dev &

# 2. Start server in virtual display (no focus/throttling issues!)
pixi run tauri-driver-server-xvfb &
# Wait for: {"status":"ready","port":9222,"url":"http://127.0.0.1:9222"}

# 3. Run commands - they automatically connect to the server!
pixi run tauri-driver click "button"
pixi run tauri-driver type "input" "hello"
pixi run tauri-driver screenshot --output /tmp/screen.png
pixi run tauri-driver snapshot --output /tmp/dom.yaml
pixi run tauri-driver eval "document.title"

# 4. Stop when done
pixi run tauri-driver stop
```

## Why Server Mode?

- **No startup delay**: App stays running between commands
- **No batching**: Send commands one at a time, asynchronously
- **Instant execution**: Commands execute immediately
- **Not affected by window focus**: Works in background

## Commands

| Command | Example |
|---------|---------|
| Click | `pixi run tauri-driver click "button.submit"` |
| Type | `pixi run tauri-driver type "input[name=email]" "user@example.com"` |
| Screenshot | `pixi run tauri-driver screenshot --output /tmp/screen.png` |
| Snapshot | `pixi run tauri-driver snapshot --output /tmp/dom.yaml` |
| Eval | `pixi run tauri-driver eval "document.title"` |
| Wait | `pixi run tauri-driver wait ".element" --timeout 3000` |
| Wait (gone) | `pixi run tauri-driver wait ".modal" --gone --timeout 5000` |
| Status | `pixi run tauri-driver status` |
| Stop | `pixi run tauri-driver stop` |

## Response Format

```json
{"success": true, "result": {"path": "/tmp/screen.png", "width": 1280, "height": 720}}
```

## How --xvfb Works

The `--xvfb` flag (used by `tauri-driver-server-xvfb`):
1. Starts Xvfb on an available display (e.g., `:99`)
2. Waits for the display to be ready (polls with `xdpyinfo`)
3. Sets `DISPLAY` environment variable automatically
4. Cleans up Xvfb when the server stops

**Requirements:** `sudo apt install xvfb x11-utils` (Debian/Ubuntu)

## Known Limitations

- **Screenshots fail on canvas views**: The annotation canvas uses HTML `<canvas>` which html2canvas can't capture. Use DOM snapshots instead to verify state.
- **Eval returns null**: JavaScript evaluation may not return values properly. Use DOM snapshots to check element state.

## Cleanup

If server won't start:

```bash
pixi run tauri-driver stop
pixi run tauri-driver-cleanup
pkill Xvfb 2>/dev/null
pkill tauri-driver 2>/dev/null
```
