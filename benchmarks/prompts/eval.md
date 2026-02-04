# Execute JavaScript

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built.

## Task

1. Start the tauri-test server with the test app
2. Wait for the server to be ready
3. Execute JavaScript to get the document title
4. Execute JavaScript to get the current app state
5. Execute JavaScript to count the number of buttons on the page
6. Stop the server

## Available Commands

- `pixi run test-server` - Start server (use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Eval via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"return document.title"}'`

## Success Criteria

- Document title is "Tauri Test App"
- App state object is retrieved successfully
- Button count is retrieved (should be 3+)
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

Start the server, run the eval commands, verify results, then stop.
