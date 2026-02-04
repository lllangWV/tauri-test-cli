# Type Text into Input

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built.

## Task

1. Start the tauri-test server with the test app
2. Wait for the server to be ready
3. Type "benchmark-user" into the username field (`#username`)
4. Verify the text was entered by checking the input value
5. Stop the server

## Available Commands

- `pixi run test-server` - Start server (use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Type via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"type","selector":"#username","text":"benchmark-user"}'`
- Eval via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"return document.getElementById(\"username\").value"}'`

## Success Criteria

- Type command succeeds
- Input value equals "benchmark-user"
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

Start the server, type text, verify, then stop.
