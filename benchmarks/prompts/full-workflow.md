# Complete Testing Workflow

You are testing a Tauri application using the `tauri-driver-cli` tool. The test app is already built.

## Task

Perform a complete end-to-end test of the application:

1. Start the tauri-driver server with the test app
2. Wait for the server to be ready
3. Take an initial screenshot (`/tmp/benchmark-initial.png`)
4. Get a DOM snapshot to understand the page structure
5. Fill out the form:
   - Username: "Test User"
   - Email: "test@benchmark.com"
   - Message: "Automated test message"
6. Click submit
7. Verify the submission was recorded
8. Click on "Item 2" in the list
9. Verify the item was selected
10. Take a final screenshot (`/tmp/benchmark-final.png`)
11. Compare initial and final app states
12. Stop the server and report results

## Available Commands

All commands via curl to `http://127.0.0.1:9222`:
- Screenshot: `{"cmd":"screenshot","output":"<path>"}`
- Snapshot: `{"cmd":"snapshot"}`
- Type: `{"cmd":"type","selector":"<sel>","text":"<text>"}`
- Click: `{"cmd":"click","selector":"<sel>"}`
- Eval: `{"cmd":"eval","script":"<js>"}`
- Wait: `{"cmd":"wait","selector":"<sel>","timeout":<ms>}`

Server management:
- `pixi run test-server` - Start server (use &)
- `pixi run stop` - Stop server

## Success Criteria

- Initial screenshot taken
- Form filled and submitted
- `window.appState.submissions` > 0
- List item clicked
- `window.appState.selectedItem` equals "2"
- Final screenshot taken
- Server stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

This is the most comprehensive test. Take your time and verify each step.
