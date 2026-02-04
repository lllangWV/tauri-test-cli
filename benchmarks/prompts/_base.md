# Base Context for tauri-test-cli Testing

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built and ready.

## Available Tools (via pixi run)

You have access to these commands through `pixi run`:

### Server Management
- `pixi run test-server` - Start the tauri-test server with the test app
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- `pixi run cleanup` - Kill stale WebDriver processes

### Testing Commands (when server is running)
- `pixi run bun run ./src/cli.ts click "<selector>"` - Click an element
- `pixi run bun run ./src/cli.ts type "<selector>" "<text>"` - Type text into an element
- `pixi run bun run ./src/cli.ts screenshot --output <path>` - Take a screenshot
- `pixi run bun run ./src/cli.ts snapshot --output <path>` - Get DOM tree (YAML)
- `pixi run bun run ./src/cli.ts eval "<script>"` - Execute JavaScript
- `pixi run bun run ./src/cli.ts wait "<selector>" --timeout <ms>` - Wait for element

### Alternative: curl commands (when server is running)
```bash
curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"#button"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"type","selector":"#input","text":"hello"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/screen.png"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"return document.title"}'
curl -s http://127.0.0.1:9222 -d '{"cmd":"wait","selector":".element","timeout":5000}'
```

## Test App Structure

The test app (`apps/test-app`) has these elements:
- `#username` - Text input for username
- `#email` - Email input
- `#message` - Textarea for message
- `#submit-btn` - Submit button (class: btn-primary)
- `#reset-btn` - Reset button (class: btn-secondary)
- `#modal-btn` - Button to show modal
- `#output` - Output div showing logs
- `#item-list` - List with clickable items (Item 1, Item 2, Item 3)
- `#modal` - Modal dialog (hidden by default, add class "visible" to show)
- `window.appState` - JavaScript object tracking clicks, submissions, formData

## Working Directory

You are in: `/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

## Important Notes

1. Always start the server before running test commands
2. The server runs on port 9222 by default
3. Use `pixi run` for all commands to ensure correct environment
4. Check results using eval or screenshot to verify actions worked
5. Clean up by stopping the server when done
