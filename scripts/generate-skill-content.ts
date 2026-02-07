#!/usr/bin/env bun
/**
 * Reads skills/tauri-test-cli/SKILL.md and generates src/generated/skill-content.ts
 * with the content embedded as a string constant for bundling.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SKILL_PATH = resolve(ROOT, "skills/tauri-test-cli/SKILL.md");
const OUT_DIR = resolve(ROOT, "src/generated");
const OUT_PATH = resolve(OUT_DIR, "skill-content.ts");

const raw = readFileSync(SKILL_PATH, "utf-8");

// Escape for template literal embedding
const escaped = raw
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$/g, "\\$");

const output = `// AUTO-GENERATED — do not edit. Run: bun scripts/generate-skill-content.ts
export const SKILL_MD_CONTENT = \`${escaped}\`;
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, output, "utf-8");
console.log(`Generated ${OUT_PATH}`);
