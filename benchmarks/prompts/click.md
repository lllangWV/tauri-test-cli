# Click a Button

You are testing a Tauri application using the `tauri-driver-cli` tool. The test app is already built.

## Task

1. Start the tauri-driver server with the test app
2. Wait for the server to be ready
3. Click the submit button (`#submit-btn`)
4. Verify the click was registered by checking `window.appState.clicks`
5. Stop the server

## Available Commands

- `pixi run test-server` - Start server (use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Click via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"#submit-btn"}'`
- Eval via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"return window.appState.clicks"}'`

## Success Criteria

- Click command succeeds
- `window.appState.clicks` is greater than 0
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

Start the server, click the button, verify, then stop.
