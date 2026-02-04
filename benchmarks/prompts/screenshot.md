# Take a Screenshot

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built.

## Task

1. Start the tauri-test-cli server with the test app
2. Wait for the server to be ready
3. Take a screenshot and save it to `/tmp/benchmark-screenshot.png`
4. Verify the screenshot was created
5. Stop the server

## Available Commands

- `pixi run test-server` - Start server (runs in foreground, use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Screenshot via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/benchmark-screenshot.png"}'`

## Success Criteria

- Screenshot file exists at `/tmp/benchmark-screenshot.png`
- File size is greater than 0
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

Start by running the server in background, then take the screenshot.
