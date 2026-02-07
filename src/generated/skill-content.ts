// AUTO-GENERATED — do not edit. Run: bun scripts/generate-skill-content.ts
export const SKILL_MD_CONTENT = `---
name: tauri-test-cli
description: Use when needing to visually verify Tauri app behavior, test UI interactions, take screenshots, or inspect DOM state.
---

# tauri-test-cli

Visual testing CLI for Tauri apps. Start server once, send commands anytime.

## Step 1: Detect Runtime & Set Command Prefix

> **Local dependency?** If \`node_modules/tauri-test-cli\` exists in the project, skip Steps 1-2 and use \`npx tauri-test-cli\` (or \`pnpm exec tauri-test-cli\` / \`bunx tauri-test-cli\`) as your command prefix.

Determine how to invoke tauri-test-cli based on the project:

\`\`\`bash
# Check what's available
ls pixi.toml bun.lock package-lock.json pnpm-lock.yaml 2>/dev/null
\`\`\`

Set your command prefix for ALL subsequent commands:
- **pixi + bun** (pixi.toml + bun.lock): \`pixi run bunx tauri-test-cli\`
- **pixi + npm** (pixi.toml, no bun): \`pixi run npx tauri-test-cli\`
- **bun** (bun.lock, no pixi): \`bunx tauri-test-cli\`
- **npm** (package-lock.json): \`npx tauri-test-cli\`
- **pnpm** (pnpm-lock.yaml): \`pnpm dlx tauri-test-cli\`

Use this prefix for EVERY command below. Examples below use \`CMD\` as placeholder.

## Step 2: Ensure Latest Version

**bunx and npx cache aggressively.** Always clear all caches before running:

\`\`\`bash
# Clear ALL known cache locations
rm -rf /tmp/bunx-*tauri-test-cli* 2>/dev/null        # bunx temp cache (primary)
rm -rf ~/.bun/install/cache/tauri-test-cli* 2>/dev/null  # bun install cache
rm -rf ~/.npm/_npx/*/node_modules/tauri-test-cli 2>/dev/null  # npx cache
\`\`\`

This ensures you always get the latest published version.

## Step 3: Check Dependencies

\`\`\`bash
CMD check-deps
\`\`\`

If tauri-driver is missing:
\`\`\`bash
CMD setup
\`\`\`

## Step 4: Find the App Binary

\`\`\`bash
# Search for tauri.conf.json to find the app name
find . -name "tauri.conf.json" -not -path "*/node_modules/*" 2>/dev/null

# Common binary locations:
# ./target/debug/app-name
# ./src-tauri/target/debug/app-name
# ./apps/*/src-tauri/target/debug/app-name
\`\`\`

Read \`tauri.conf.json\` to get the app identifier/name. Check if the binary exists:
\`\`\`bash
ls ./path/to/target/debug/app-name 2>/dev/null
\`\`\`

If missing, build it:
\`\`\`bash
# If pixi project:
pixi run cargo build --manifest-path ./path/to/src-tauri/Cargo.toml
# Otherwise:
cd ./path/to/src-tauri && cargo build
\`\`\`

## Step 5: Check if Dev Server Needed

Read \`tauri.conf.json\` — if it has a \`devUrl\` (e.g., \`http://localhost:5173\`), the debug binary needs the frontend dev server running.

\`\`\`bash
# 1. Check if devUrl exists
grep -o '"devUrl".*' path/to/tauri.conf.json

# 2. If devUrl found, check if the dev server is already reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173

# 3. If curl fails (connection refused / non-200), start the dev server
# Look at package.json for the right dev command
cd frontend-dir && npm run dev &
sleep 5

# 4. Verify it's reachable now
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
\`\`\`

If \`build/\` or \`dist/\` exists in the frontend directory, the binary may work without a dev server — but verify by checking the app loads correctly after starting the server.

## Step 6: Clean Up & Start Server

**IMPORTANT on Linux:** Always use \`--xvfb\` flag. This avoids window focus and rendering issues.

\`\`\`bash
# Clean up any stale processes first
CMD cleanup

# Start server (--xvfb on Linux, omit on macOS)
CMD server --app ./path/to/binary --xvfb &

# Wait for server — it can take 15-20 seconds
sleep 15
CMD status
\`\`\`

If status says "No server running", wait longer:
\`\`\`bash
sleep 10
CMD status
\`\`\`

**DO NOT** try to manually start Xvfb, use the existing Wayland display, or work around \`--xvfb\` failures. If \`--xvfb\` fails, check the error message and report it.

## Quick Reference

| Action | Command |
|--------|---------|
| Check deps | \`CMD check-deps\` |
| Status | \`CMD status\` |
| Start server | \`CMD server --app ./path/to/app --xvfb &\` |
| Click | \`CMD click "selector"\` |
| Type | \`CMD type "selector" "text"\` |
| Screenshot | \`CMD screenshot --output /tmp/screen.png\` |
| DOM snapshot | \`CMD snapshot --output /tmp/dom.yaml\` |
| Wait appear | \`CMD wait "selector" --timeout 3000\` |
| Wait gone | \`CMD wait "selector" --gone --timeout 5000\` |
| Eval JS | \`CMD eval "document.title"\` |
| Stop | \`CMD stop\` |
| Cleanup | \`CMD cleanup\` |

## After Server Starts

\`\`\`bash
# Always take an initial screenshot to verify the app loaded
CMD screenshot --output /tmp/initial.png
# Use Read tool to view the screenshot!

# Run test commands
CMD click "button"
CMD screenshot --output /tmp/after-click.png

# When done
CMD stop
\`\`\`

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Connection refused" in screenshot | Frontend dev server not running | Start frontend: \`npm run dev\` |
| Blank/white screen | App not loaded yet | Increase \`--wait\` timeout |
| "tauri-driver not found" | Missing dependency | Run \`CMD setup\` |
| "Maximum sessions" error | Stale processes | Run \`CMD cleanup\` |
| "Xvfb display failed to start" | Old CLI version (< 0.6.2) | Clear caches: \`rm -rf /tmp/bunx-*tauri-test-cli* ~/.bun/install/cache/tauri-test-cli*\` and retry |
| Server not ready after 15s | Slow app startup | Wait longer, check if dev server is needed |

## Screenshot vs Snapshot

- **Screenshot**: Visual appearance, layout, colors
- **DOM snapshot**: Element existence, text content, attributes
- **Use snapshot** for canvas elements (screenshots can't capture canvas)

## Cleanup (if stuck)

\`\`\`bash
CMD stop
CMD cleanup
pkill Xvfb 2>/dev/null   # Linux only
\`\`\`
`;
