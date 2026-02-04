---
name: tauri-test-cli
description: Use when needing to visually verify Tauri app behavior, test UI interactions, take screenshots, or inspect DOM state.
---

# tauri-test-cli

Visual testing CLI for Tauri apps. Start server once, send commands anytime.

## Quick Reference

| Action | Command |
|--------|---------|
| Status | `tauri-test status` |
| Start server | `tauri-test server --app ./path/to/app --xvfb &` |
| Click | `tauri-test click "selector"` |
| Type | `tauri-test type "selector" "text"` |
| Screenshot | `tauri-test screenshot --output /tmp/screen.png` |
| DOM snapshot | `tauri-test snapshot --output /tmp/dom.yaml` |
| Wait appear | `tauri-test wait "selector" --timeout 3000` |
| Wait gone | `tauri-test wait "selector" --gone --timeout 5000` |
| Eval JS | `tauri-test eval "document.title"` |
| Stop | `tauri-test stop` |

## Workflow

```bash
# 1. Check/start server
tauri-test status
tauri-test server --app ./path/to/app --xvfb &
# Wait for: {"status":"ready","port":9222}

# 2. Run commands (auto-connect to server)
tauri-test click "button"
tauri-test screenshot --output /tmp/screen.png

# 3. View results with Read tool
# 4. Cleanup when done
tauri-test stop
```

## Screenshot vs Snapshot

```dot
digraph choice {
    "Need visual verification?" [shape=diamond];
    "Canvas or dynamic content?" [shape=diamond];
    "Use screenshot" [shape=box];
    "Use DOM snapshot" [shape=box];

    "Need visual verification?" -> "Canvas or dynamic content?" [label="yes"];
    "Canvas or dynamic content?" -> "Use DOM snapshot" [label="yes"];
    "Canvas or dynamic content?" -> "Use screenshot" [label="no"];
}
```

- **Screenshot**: Visual appearance, layout verification
- **DOM snapshot**: Element existence, text content, state verification
- **Canvas limitation**: Screenshots can't capture `<canvas>` - use snapshots

## Common Pattern: Form Test

```bash
tauri-test type "input[name=email]" "user@test.com"
tauri-test click "button[type=submit]"
tauri-test wait ".loading" --timeout 3000
tauri-test wait ".loading" --gone --timeout 5000
tauri-test snapshot --output /tmp/result.yaml
```

## Cleanup (if stuck)

```bash
tauri-test stop
tauri-test cleanup
pkill Xvfb 2>/dev/null
```
