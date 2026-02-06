# CLAUDE.md

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning 
for any pixi, tauri, bun, svelte, tasks.

## Required: Use pixi for all commands

**Never run directly:**
- `cargo build` / `cargo run` / `cargo test`
- `bun install` / `bun run`

**Always use:**
- `pixi run cargo build` / `pixi run cargo test`
- `pixi run bun install` / `pixi run bun run dev`

This ensures isolated environments without system package contamination.

## Testing the app

Open `assets/` folder to test with sample images.

## Plan mode 

- Make the plan extremely concise, Sacrifice grammar for the sake of concisiion
- At the end of each plan, give me a list of unresolve questions to answer, if any

## Visual Testing

To verify tauri-test-cli works correctly, read `skills/tauri-test-cli/SKILL.md` for usage.


## A Note To The Agent

We are building this together. WHen you learn something non-obvious, add it here so future changes go faster