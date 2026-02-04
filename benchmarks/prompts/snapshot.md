# Get DOM Snapshot

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built.

## Task

1. Start the tauri-test server with the test app
2. Wait for the server to be ready
3. Get a DOM snapshot and save it to `/tmp/benchmark-snapshot.yaml`
4. Verify the snapshot contains expected elements (like "Username", "Submit")
5. Stop the server

## Available Commands

- `pixi run test-server` - Start server (use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Snapshot via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"snapshot","output":"/tmp/benchmark-snapshot.yaml"}'`

## Success Criteria

- Snapshot file exists at `/tmp/benchmark-snapshot.yaml`
- File contains "Username" and "Submit" text
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

Start the server, get snapshot, verify contents, then stop.
