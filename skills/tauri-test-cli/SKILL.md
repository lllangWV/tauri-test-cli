---
name: tauri-test-cli
description: Use when needing to visually verify Tauri app behavior, test UI interactions, take screenshots, or inspect DOM state.
---

# tauri-test-cli

Visual testing CLI for Tauri apps. Start server once, send commands anytime.

## Before You Start

**IMPORTANT:** Always use a package runner - never bare `tauri-test-cli`:
- `npx tauri-test-cli` (npm)
- `bunx tauri-test-cli` (bun)
- `pnpm dlx tauri-test-cli` (pnpm)

Use whichever runtime the project prefers (check package.json scripts or lockfiles).

### 1. Check Prerequisites

```bash
# Check if tauri-driver is installed
npx tauri-test-cli check-deps
```

If tauri-driver is missing:
```bash
npx tauri-test-cli setup   # Installs tauri-driver via cargo
```

### 2. For Dev-Mode Apps

If testing a debug build that uses a dev server (vite, webpack, etc.):
- The frontend dev server MUST be running first
- Check project's package.json for dev command (e.g., `npm run dev`, `pnpm dev`)
- Look for "Connection refused" errors in screenshots = frontend not running

### 3. Find the App Binary

```bash
# Common locations:
./target/debug/app-name           # Rust/Tauri debug build
./target/release/app-name         # Rust/Tauri release build
./src-tauri/target/debug/app-name # If src-tauri is nested
```

## Quick Reference

| Action | Command |
|--------|---------|
| Check deps | `npx tauri-test-cli check-deps` |
| Status | `npx tauri-test-cli status` |
| Start server | `npx tauri-test-cli server --app ./path/to/app --xvfb &` |
| Click | `npx tauri-test-cli click "selector"` |
| Type | `npx tauri-test-cli type "selector" "text"` |
| Screenshot | `npx tauri-test-cli screenshot --output /tmp/screen.png` |
| DOM snapshot | `npx tauri-test-cli snapshot --output /tmp/dom.yaml` |
| Wait appear | `npx tauri-test-cli wait "selector" --timeout 3000` |
| Wait gone | `npx tauri-test-cli wait "selector" --gone --timeout 5000` |
| Eval JS | `npx tauri-test-cli eval "document.title"` |
| Stop | `npx tauri-test-cli stop` |
| Cleanup | `npx tauri-test-cli cleanup` |

## Workflow

```bash
# 1. Check prerequisites
npx tauri-test-cli check-deps

# 2. Clean up any stale processes
npx tauri-test-cli cleanup

# 3. Start server (use --xvfb on Linux for headless)
npx tauri-test-cli server --app ./target/debug/my-app --xvfb &

# 4. Wait for ready message, then check status
sleep 5
npx tauri-test-cli status

# 5. Take initial screenshot to verify app loaded correctly
npx tauri-test-cli screenshot --output /tmp/initial.png
# Use Read tool to view the screenshot!

# 6. Run test commands
npx tauri-test-cli click "button"
npx tauri-test-cli screenshot --output /tmp/after-click.png

# 7. Cleanup when done
npx tauri-test-cli stop
```

## Pixi Environment (Linux)

If running inside a pixi/conda environment, WebKitGTK's GPU rendering will likely fail due to driver mismatches. Set these env vars before launching:

```bash
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1
```

Or add to `pixi.toml`:
```toml
[activation.env]
WEBKIT_DISABLE_DMABUF_RENDERER = "1"
WEBKIT_DISABLE_COMPOSITING_MODE = "1"
```

Without these, the app may crash or render a blank window.

## Troubleshooting Screenshots

| What You See | Cause | Fix |
|--------------|-------|-----|
| "Connection refused" | Frontend dev server not running | Start frontend: `npm run dev` |
| Blank/white screen | App not loaded yet | Increase wait time, check --wait flag |
| "tauri-driver not found" | Missing dependency | Run `npx tauri-test-cli setup` |
| "Maximum sessions" error | Stale processes | Run `npx tauri-test-cli cleanup` |

## Screenshot vs Snapshot

- **Screenshot**: Visual appearance, layout, colors
- **DOM snapshot**: Element existence, text content, attributes
- **Use snapshot** for canvas elements (screenshots can't capture canvas)

## Common Pattern: Form Test

```bash
npx tauri-test-cli type "input[name=email]" "user@test.com"
npx tauri-test-cli click "button[type=submit]"
npx tauri-test-cli wait ".loading" --timeout 3000
npx tauri-test-cli wait ".loading" --gone --timeout 5000
npx tauri-test-cli snapshot --output /tmp/result.yaml
```

## Cleanup (if stuck)

```bash
npx tauri-test-cli stop
npx tauri-test-cli cleanup
pkill Xvfb 2>/dev/null   # Linux only
```
