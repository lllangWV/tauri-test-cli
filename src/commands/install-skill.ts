import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { homedir } from "os";
import { SKILL_MD_CONTENT } from "../generated/skill-content.js";

/**
 * Walk up from `cwd` looking for a `.claude/` directory.
 * Returns the project root (parent of `.claude/`) or null.
 */
function findProjectRoot(cwd: string): string | null {
  let dir = resolve(cwd);
  const root = dirname(dir) === dir ? dir : undefined; // filesystem root guard
  while (true) {
    if (existsSync(join(dir, ".claude"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // hit filesystem root
    dir = parent;
  }
  return null;
}

export interface InstallSkillOptions {
  global?: boolean;
  project?: boolean;
}

export function installSkill(opts: InstallSkillOptions = {}): { success: boolean } {
  let targetDir: string;
  let mode: string;

  if (opts.global && opts.project) {
    console.error("Error: cannot specify both --global and --project");
    return { success: false };
  }

  if (opts.global) {
    targetDir = join(homedir(), ".claude", "skills", "tauri-test-cli");
    mode = "global";
  } else if (opts.project) {
    targetDir = join(process.cwd(), ".claude", "skills", "tauri-test-cli");
    mode = "project";
  } else {
    // Auto-detect: if .claude/ exists walking up, use project-level
    const projectRoot = findProjectRoot(process.cwd());
    if (projectRoot) {
      targetDir = join(projectRoot, ".claude", "skills", "tauri-test-cli");
      mode = `project (${projectRoot})`;
    } else {
      targetDir = join(homedir(), ".claude", "skills", "tauri-test-cli");
      mode = "global";
    }
  }

  const targetPath = join(targetDir, "SKILL.md");

  // Check if already up-to-date
  if (existsSync(targetPath)) {
    const existing = readFileSync(targetPath, "utf-8");
    if (existing === SKILL_MD_CONTENT) {
      console.log(`Skill already up-to-date (${mode}): ${targetPath}`);
      return { success: true };
    }
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetPath, SKILL_MD_CONTENT, "utf-8");
  console.log(`Installed skill (${mode}): ${targetPath}`);
  return { success: true };
}
