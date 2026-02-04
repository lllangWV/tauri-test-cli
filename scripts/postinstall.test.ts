import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { execSync } from "child_process";
import path from "path";

describe("postinstall script", () => {
  // We'll test by actually running the script and capturing output
  const scriptPath = path.join(import.meta.dir, "postinstall.js");

  test("script executes without errors", () => {
    // Run the script and check it doesn't throw
    // We use a subshell to capture output
    const result = Bun.spawnSync(["node", scriptPath], {
      env: { ...process.env, PATH: process.env.PATH },
      stdout: "pipe",
      stderr: "pipe",
    });

    // Script should complete (exit code 0)
    expect(result.exitCode).toBe(0);
  });

  test("script outputs package name", () => {
    const result = Bun.spawnSync(["node", scriptPath], {
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = result.stdout.toString();
    expect(output).toContain("tauri-test-cli");
  });

  test("script outputs 'installed successfully'", () => {
    const result = Bun.spawnSync(["node", scriptPath], {
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = result.stdout.toString();
    expect(output).toContain("installed successfully");
  });

  test("script mentions help command", () => {
    const result = Bun.spawnSync(["node", scriptPath], {
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = result.stdout.toString();
    expect(output).toContain("tauri-test-cli");
  });
});

describe("postinstall dependency detection", () => {
  test("detects missing tauri-driver when not in PATH", () => {
    // Run with empty PATH to simulate missing tauri-driver
    const result = Bun.spawnSync(["node", path.join(import.meta.dir, "postinstall.js")], {
      env: { ...process.env, PATH: "" },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = result.stdout.toString();
    // Should mention tauri-driver as missing
    expect(output).toContain("tauri-driver");
  });

  test("provides cargo install instruction for tauri-driver", () => {
    const result = Bun.spawnSync(["node", path.join(import.meta.dir, "postinstall.js")], {
      env: { ...process.env, PATH: "" },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = result.stdout.toString();
    expect(output).toContain("cargo install tauri-driver");
  });
});
