# Fill and Submit Form

You are testing a Tauri application using the `tauri-test-cli` tool. The test app is already built.

## Task

1. Start the tauri-test-cli server with the test app
2. Wait for the server to be ready
3. Fill out the form:
   - Type "John Doe" into `#username`
   - Type "john@example.com" into `#email`
   - Type "Hello from benchmark!" into `#message`
4. Click the submit button (`#submit-btn`)
5. Verify the form data was captured by checking `window.appState.formData`
6. Take a screenshot to `/tmp/benchmark-form.png`
7. Stop the server

## Available Commands

- `pixi run test-server` - Start server (use & for background)
- `pixi run status` - Check if server is running
- `pixi run stop` - Stop the server
- Type: `curl -s http://127.0.0.1:9222 -d '{"cmd":"type","selector":"#username","text":"John Doe"}'`
- Click: `curl -s http://127.0.0.1:9222 -d '{"cmd":"click","selector":"#submit-btn"}'`
- Eval: `curl -s http://127.0.0.1:9222 -d '{"cmd":"eval","script":"return window.appState.formData"}'`
- Screenshot: `curl -s http://127.0.0.1:9222 -d '{"cmd":"screenshot","output":"/tmp/benchmark-form.png"}'`

## Success Criteria

- All form fields filled correctly
- Submit button clicked
- `window.appState.formData.username` equals "John Doe"
- Screenshot exists
- Server is stopped cleanly

## Working Directory

`/home/lllang/Documents/lllangWV-Projects/tauri-test-cli`

This is a multi-step task. Fill the form, submit, verify, screenshot, then stop.
