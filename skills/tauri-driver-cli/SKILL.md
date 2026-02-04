---
name: tauri-driver-cli
description: Use when needing to visually verify Tauri app behavior, test UI interactions, take screenshots, or inspect DOM state.
---

# tauri-driver-cli

Visual testing CLI for Tauri apps. Start server once, send commands anytime.

## Quick Reference

| Action | Command |
|--------|---------|
| Status | `tauri-driver status` |
| Start server | `tauri-driver server --app ./path/to/app --xvfb &` |
| Click | `tauri-driver click "selector"` |
| Type | `tauri-driver type "selector" "text"` |
| Screenshot | `tauri-driver screenshot --output /tmp/screen.png` |
| DOM snapshot | `tauri-driver snapshot --output /tmp/dom.yaml` |
| Wait appear | `tauri-driver wait "selector" --timeout 3000` |
| Wait gone | `tauri-driver wait "selector" --gone --timeout 5000` |
| Eval JS | `tauri-driver eval "document.title"` |
| Stop | `tauri-driver stop` |

## Workflow

```bash
# 1. Check/start server
tauri-driver status
tauri-driver server --app ./path/to/app --xvfb &
# Wait for: {"status":"ready","port":9222}

# 2. Run commands (auto-connect to server)
tauri-driver click "button"
tauri-driver screenshot --output /tmp/screen.png

# 3. View results with Read tool
# 4. Cleanup when done
tauri-driver stop
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
tauri-driver type "input[name=email]" "user@test.com"
tauri-driver click "button[type=submit]"
tauri-driver wait ".loading" --timeout 3000
tauri-driver wait ".loading" --gone --timeout 5000
tauri-driver snapshot --output /tmp/result.yaml
```

## Cleanup (if stuck)

```bash
tauri-driver stop
tauri-driver cleanup
pkill Xvfb 2>/dev/null
```
