import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Integration tests for tauri-test-cli
 *
 * These tests run the actual CLI against the test app in apps/test-app.
 * They require the test app to be built first:
 *   pixi run test-app-build
 *
 * Run with:
 *   pixi run test:integration
 */

const TEST_APP_PATH = join(import.meta.dir, "../apps/test-app/src-tauri/target/debug/test-app");
const CLI_PATH = join(import.meta.dir, "cli.ts");
const PORT = 19222; // Use a different port to avoid conflicts

// Helper to run CLI commands
async function runCli(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("Integration Tests", () => {
  // Check if test app exists
  const testAppExists = existsSync(TEST_APP_PATH);

  if (!testAppExists) {
    test.skip("Test app not built - run 'pixi run test-app-build' first", () => {});
    return;
  }

  describe("Utility Commands (no app required)", () => {
    test("help command", async () => {
      const { stdout, exitCode } = await runCli("help");
      expect(exitCode).toBe(0);
      expect(stdout).toContain("tauri-test");
      expect(stdout).toContain("USAGE:");
      expect(stdout).toContain("COMMANDS:");
    });

    test("--help flag", async () => {
      const { stdout, exitCode } = await runCli("--help");
      expect(exitCode).toBe(0);
      expect(stdout).toContain("tauri-test");
    });

    test("check-deps command", async () => {
      const { exitCode } = await runCli("check-deps");
      // Exit code depends on whether deps are installed
      expect([0, 1]).toContain(exitCode);
    });

    test("status command when no server", async () => {
      const { stdout, exitCode } = await runCli("status", "--port", String(PORT));
      expect(exitCode).toBe(1);
      expect(stdout).toContain("No server running");
    });

    test("cleanup command", async () => {
      const { exitCode } = await runCli("cleanup");
      expect(exitCode).toBe(0);
    });
  });

});

describe("Client Mode without Server", () => {
  const PORT = 19223; // Different port that definitely has no server

  test("shows helpful error when no server running", async () => {
    const { stderr, exitCode } = await runCli("click", "button", "--port", String(PORT));
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No server running");
    expect(stderr).toContain("tauri-test server");
  });

  test("suggests starting server", async () => {
    const { stderr } = await runCli("eval", "document.title", "--port", String(PORT));
    expect(stderr).toContain("--app");
  });
});
