# Wait for Elements

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built.

## Task

1. Start the tauri-test-cli server with the test app
2. Wait for the server to be ready
3. Use the wait command to verify the `#output` element exists
4. Use the wait command with `--gone` to verify `#modal.visible` does NOT exist (modal is hidden)
5. Click the modal button to show the modal
6. Use JavaScript to add the 'visible' class to the modal
7. Use wait to verify `#modal.visible` now exists
8. Stop the server

## Available Commands

- `pixi run test-server` - Start server (use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Wait via curl: `curl -s http://127.0.0.1:9222 -d '{"cmd":"wait","selector":"#output","timeout":5000}'`
- Wait gone: `curl -s http://127.0.0.1:9222 -d '{"cmd":"wait","selector":"#modal.visible","timeout":3000,"gone":true}'`
- Click: `curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"#modal-btn"}'`
- Eval: `curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"document.getElementById(\"modal\").classList.add(\"visible\")"}'`

## Success Criteria

- Wait for `#output` succeeds (element exists)
- Wait --gone for `#modal.visible` succeeds (modal hidden)
- After showing modal, wait for `#modal.visible` succeeds
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

This tests the wait command with both presence and absence checks.
