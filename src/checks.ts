import { execSync } from "child_process";
import os from "os";

// ANSI color codes
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const green = "\x1b[32m";
const dim = "\x1b[2m";

interface MissingDependency {
  name: string;
  install: string;
  reason: string;
}

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
  try {
    const checkCmd = os.platform() === "win32"
      ? `where ${cmd} 2>nul`
      : `which ${cmd} 2>/dev/null`;
    execSync(checkCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a pkg-config package exists
 */
function pkgConfigExists(pkg: string): boolean {
  try {
    // Use --modversion instead of --exists as it's more reliable across environments
    execSync(`pkg-config --modversion ${pkg}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check for required dependencies and return any that are missing
 */
export function checkDependencies(): MissingDependency[] {
  const missing: MissingDependency[] = [];

  // Check for tauri-driver (required on all platforms)
  if (!commandExists("tauri-driver")) {
    missing.push({
      name: "tauri-driver",
      install: "cargo install tauri-driver",
      reason: "Required to control Tauri applications via WebDriver protocol",
    });
  }

  // Linux-specific checks
  if (os.platform() === "linux") {
    // Check for webkit2gtk (needed for WebDriver communication)
    if (!pkgConfigExists("webkit2gtk-4.1")) {
      missing.push({
        name: "webkit2gtk-4.1",
        install: [
          "# Debian/Ubuntu:",
          "sudo apt install libwebkit2gtk-4.1-dev",
          "",
          "# Fedora:",
          "sudo dnf install webkit2gtk4.1-devel",
          "",
          "# Arch:",
          "sudo pacman -S webkit2gtk-4.1",
          "",
          "# Or use pixi (recommended):",
          "pixi add webkit2gtk4.1",
        ].join("\n"),
        reason: "Required for WebDriver to communicate with Tauri's WebView",
      });
    }
  }

  return missing;
}

/**
 * Print missing dependencies and exit if any are missing
 * @param exitOnMissing - If true, exits process when dependencies are missing
 * @returns true if all dependencies are present, false otherwise
 */
export function ensureDependencies(exitOnMissing = true): boolean {
  const missing = checkDependencies();

  if (missing.length === 0) {
    return true;
  }

  console.error();
  console.error(`${red}${bold}Missing required dependencies:${reset}`);
  console.error();

  for (const dep of missing) {
    console.error(`  ${red}✗ ${dep.name}${reset}`);
    console.error(`    ${dim}${dep.reason}${reset}`);
    console.error();
    console.error(`    ${yellow}Install with:${reset}`);
    for (const line of dep.install.split("\n")) {
      if (line.startsWith("#")) {
        console.error(`      ${dim}${line}${reset}`);
      } else if (line.trim()) {
        console.error(`      ${green}${line}${reset}`);
      } else {
        console.error();
      }
    }
    console.error();
  }

  if (exitOnMissing) {
    process.exit(1);
  }

  return false;
}

/**
 * Print a quick status check of all dependencies
 */
export function printDependencyStatus(): void {
  console.log();
  console.log(`${bold}Dependency Status:${reset}`);
  console.log();

  // tauri-driver
  const hasTauriDriver = commandExists("tauri-driver");
  const tauriStatus = hasTauriDriver ? `${green}✓${reset}` : `${red}✗${reset}`;
  console.log(`  ${tauriStatus} tauri-driver`);

  // Platform-specific
  if (os.platform() === "linux") {
    const hasWebkit = pkgConfigExists("webkit2gtk-4.1");
    const webkitStatus = hasWebkit ? `${green}✓${reset}` : `${red}✗${reset}`;
    console.log(`  ${webkitStatus} webkit2gtk-4.1`);
  } else if (os.platform() === "darwin") {
    console.log(`  ${green}✓${reset} WebKit ${dim}(included in macOS)${reset}`);
  } else if (os.platform() === "win32") {
    console.log(`  ${green}✓${reset} WebView2 ${dim}(included in Windows 10/11)${reset}`);
  }

  console.log();
}
