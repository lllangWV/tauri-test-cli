import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

/**
 * Integration tests for tauri-driver-cli
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

// Helper to send command to server via curl
async function sendToServer(cmd: object): Promise<{ data: unknown; ok: boolean }> {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    const data = await response.json();
    return { data, ok: response.ok };
  } catch (err) {
    return { data: { error: String(err) }, ok: false };
  }
}

// Helper to check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/status`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper to wait for server to be ready
async function waitForServer(maxWaitMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (await isServerRunning()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// Helper to stop server
async function stopServer(): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${PORT}/stop`, { signal: AbortSignal.timeout(5000) });
  } catch {
    // Ignore errors - server may already be stopped
  }
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
      expect(stdout).toContain("tauri-driver");
      expect(stdout).toContain("USAGE:");
      expect(stdout).toContain("COMMANDS:");
    });

    test("--help flag", async () => {
      const { stdout, exitCode } = await runCli("--help");
      expect(exitCode).toBe(0);
      expect(stdout).toContain("tauri-driver");
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

  describe("Server Mode", () => {
    let serverProcess: ReturnType<typeof Bun.spawn> | null = null;

    beforeAll(async () => {
      // Ensure no server is running on our port
      await stopServer();

      // Start the server in background
      serverProcess = Bun.spawn(["bun", "run", CLI_PATH, "server", "--app", TEST_APP_PATH, "--port", String(PORT)], {
        stdout: "pipe",
        stderr: "pipe",
      });

      // Wait for server to be ready
      const ready = await waitForServer();
      if (!ready) {
        throw new Error("Server failed to start within timeout");
      }
    });

    afterAll(async () => {
      // Stop the server
      await stopServer();

      // Kill the process if still running
      if (serverProcess) {
        serverProcess.kill();
        await serverProcess.exited;
      }
    });

    test("server is running", async () => {
      const running = await isServerRunning();
      expect(running).toBe(true);
    });

    test("status command shows server running", async () => {
      const { stdout, exitCode } = await runCli("status", "--port", String(PORT));
      expect(exitCode).toBe(0);
      expect(stdout).toContain("running");
    });

    describe("eval command", () => {
      test("returns document title", async () => {
        const { data, ok } = await sendToServer({ cmd: "eval", script: "return document.title" });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);
        expect((data as Record<string, unknown>).result).toBe("Tauri Test App");
      });

      test("executes JavaScript", async () => {
        const { data, ok } = await sendToServer({ cmd: "eval", script: "return 1 + 1" });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).result).toBe(2);
      });

      test("accesses window object", async () => {
        const { data, ok } = await sendToServer({ cmd: "eval", script: "return typeof window.appState" });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).result).toBe("object");
      });
    });

    describe("snapshot command", () => {
      test("returns DOM tree", async () => {
        const { data, ok } = await sendToServer({ cmd: "snapshot" });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);
        const result = (data as Record<string, unknown>).result as string;
        expect(result).toContain("body");
        expect(result).toContain("Tauri Driver Test App");
      });

      test("writes to file when output specified", async () => {
        const outputPath = "/tmp/tauri-driver-test-snapshot.yaml";
        if (existsSync(outputPath)) unlinkSync(outputPath);

        const { data, ok } = await sendToServer({ cmd: "snapshot", output: outputPath });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);
        expect(existsSync(outputPath)).toBe(true);

        // Cleanup
        if (existsSync(outputPath)) unlinkSync(outputPath);
      });
    });

    describe("screenshot command", () => {
      test("takes screenshot", async () => {
        const outputPath = "/tmp/tauri-driver-test-screenshot.png";
        if (existsSync(outputPath)) unlinkSync(outputPath);

        const { data, ok } = await sendToServer({ cmd: "screenshot", output: outputPath });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);
        expect(existsSync(outputPath)).toBe(true);

        // Cleanup
        if (existsSync(outputPath)) unlinkSync(outputPath);
      });

      test("returns dimensions", async () => {
        const { data, ok } = await sendToServer({ cmd: "screenshot" });
        expect(ok).toBe(true);
        const result = (data as Record<string, unknown>).result as Record<string, unknown>;
        expect(result).toHaveProperty("width");
        expect(result).toHaveProperty("height");
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      });
    });

    describe("click command", () => {
      test("clicks element by selector", async () => {
        // Reset app state first
        await sendToServer({ cmd: "eval", script: "window.appState.clicks = 0" });

        const { data, ok } = await sendToServer({ cmd: "click", selector: "#submit-btn" });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);

        // Verify click was registered
        const { data: stateData } = await sendToServer({ cmd: "eval", script: "return window.appState.clicks" });
        expect((stateData as Record<string, unknown>).result).toBeGreaterThan(0);
      });

      test("fails with invalid selector", async () => {
        const { data } = await sendToServer({ cmd: "click", selector: "#nonexistent-element-12345" });
        // Server may return HTTP error or success:false
        const result = data as Record<string, unknown>;
        expect(result.success === false || result.error !== undefined).toBe(true);
      });

      test("requires selector", async () => {
        const { data } = await sendToServer({ cmd: "click" });
        const result = data as Record<string, unknown>;
        // Should fail - either via HTTP error or success:false
        expect(result.success === false || result.error !== undefined).toBe(true);
      });
    });

    describe("type command", () => {
      test("types text into input", async () => {
        // Clear input first
        await sendToServer({ cmd: "eval", script: "document.getElementById('username').value = ''" });

        const testText = "integration-test-user";
        const { data, ok } = await sendToServer({ cmd: "type", selector: "#username", text: testText });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);

        // Verify text was typed
        const { data: valueData } = await sendToServer({
          cmd: "eval",
          script: "return document.getElementById('username').value",
        });
        expect((valueData as Record<string, unknown>).result).toBe(testText);
      });

      test("requires selector and text", async () => {
        const { data: noSelector } = await sendToServer({ cmd: "type", text: "test" });
        const result1 = noSelector as Record<string, unknown>;
        expect(result1.success === false || result1.error !== undefined).toBe(true);

        const { data: noText } = await sendToServer({ cmd: "type", selector: "#username" });
        const result2 = noText as Record<string, unknown>;
        expect(result2.success === false || result2.error !== undefined).toBe(true);
      });
    });

    describe("wait command", () => {
      test("waits for existing element", async () => {
        const { data, ok } = await sendToServer({ cmd: "wait", selector: "#output", timeout: 3000 });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);
        const result = (data as Record<string, unknown>).result as Record<string, unknown>;
        expect(result.found).toBe(true);
      });

      test("times out for non-existent element", async () => {
        const { data } = await sendToServer({
          cmd: "wait",
          selector: "#nonexistent-element-99999",
          timeout: 1000,
        });
        const result = data as Record<string, unknown>;
        // Should fail - either via HTTP error or success:false
        expect(result.success === false || result.error !== undefined).toBe(true);
      });

      test("wait --gone for element removal", async () => {
        // First ensure modal is hidden
        await sendToServer({ cmd: "eval", script: "document.getElementById('modal').classList.remove('visible')" });

        const { data, ok } = await sendToServer({
          cmd: "wait",
          selector: "#modal.visible",
          gone: true,
          timeout: 3000,
        });
        expect(ok).toBe(true);
        expect((data as Record<string, unknown>).success).toBe(true);
      });
    });

    describe("CLI client mode", () => {
      test("eval via CLI", async () => {
        const { stdout, exitCode } = await runCli("eval", "return document.title", "--port", String(PORT));
        expect(exitCode).toBe(0);
        expect(stdout).toContain("Tauri Test App");
      });

      test("click via CLI", async () => {
        const { stdout, exitCode } = await runCli("click", "#reset-btn", "--port", String(PORT));
        expect(exitCode).toBe(0);
        expect(stdout).toContain("success");
      });

      test("snapshot via CLI", async () => {
        const { stdout, exitCode } = await runCli("snapshot", "--port", String(PORT));
        expect(exitCode).toBe(0);
        expect(stdout).toContain("body");
      });

      test("wait via CLI", async () => {
        const { stdout, exitCode } = await runCli("wait", "#output", "--timeout", "3000", "--port", String(PORT));
        expect(exitCode).toBe(0);
        expect(stdout).toContain("found");
      });
    });

    describe("Error handling", () => {
      test("unknown command returns error", async () => {
        const { data } = await sendToServer({ cmd: "unknowncommand123" });
        const result = data as Record<string, unknown>;
        // Should fail - either via HTTP error or success:false with error message
        expect(result.success === false || result.error !== undefined).toBe(true);
      });

      test("malformed JSON returns error", async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${PORT}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not valid json",
          });
          const data = await response.json();
          expect(data.error).toBeDefined();
        } catch {
          // Connection error is also acceptable
        }
      });
    });
  });
});

describe("Client Mode without Server", () => {
  const PORT = 19223; // Different port that definitely has no server

  test("shows helpful error when no server running", async () => {
    const { stderr, exitCode } = await runCli("click", "button", "--port", String(PORT));
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No server running");
    expect(stderr).toContain("tauri-driver server");
  });

  test("suggests starting server", async () => {
    const { stderr } = await runCli("eval", "document.title", "--port", String(PORT));
    expect(stderr).toContain("--app");
  });
});
