#!/usr/bin/env node

import { execSync } from "child_process";
import os from "os";

// ANSI color codes
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const yellow = "\x1b[33m";
const green = "\x1b[32m";
const cyan = "\x1b[36m";
const dim = "\x1b[2m";

const warnings = [];

// Check for tauri-driver
try {
  execSync("which tauri-driver 2>/dev/null || where tauri-driver 2>nul", {
    stdio: "ignore",
  });
} catch {
  warnings.push({
    name: "tauri-driver",
    install: "cargo install tauri-driver",
    reason: "Required to control Tauri applications via WebDriver",
  });
}

// Linux-specific checks
if (os.platform() === "linux") {
  // Check for webkit2gtk (use --modversion as it's more reliable)
  try {
    execSync("pkg-config --modversion webkit2gtk-4.1", { stdio: "ignore" });
  } catch {
    warnings.push({
      name: "webkit2gtk-4.1",
      install: "sudo apt install libwebkit2gtk-4.1-dev  # Debian/Ubuntu\nsudo dnf install webkit2gtk4.1-devel        # Fedora\nsudo pacman -S webkit2gtk-4.1               # Arch\npixi add webkit2gtk4.1                      # Or use pixi",
      reason: "Required for WebDriver to communicate with Tauri's WebView",
    });
  }
}

// Print output
console.log();
console.log(`${cyan}${bold}tauri-driver-cli${reset} installed successfully!`);
console.log();

if (warnings.length > 0) {
  console.log(`${yellow}${bold}Missing dependencies:${reset}`);
  console.log();

  for (const warning of warnings) {
    console.log(`  ${yellow}! ${warning.name}${reset}`);
    console.log(`    ${dim}${warning.reason}${reset}`);
    console.log();
    console.log(`    Install with:`);
    for (const line of warning.install.split("\n")) {
      console.log(`      ${green}${line}${reset}`);
    }
    console.log();
  }

  console.log(`${dim}Run 'tauri-driver --help' for usage information.${reset}`);
} else {
  console.log(`${green}All dependencies found!${reset}`);
  console.log(`${dim}Run 'tauri-driver --help' to get started.${reset}`);
}

console.log();
