import { describe, test, expect } from "bun:test";
import { stopServer, cleanup, checkXvfb, buildXvfbCommand } from "./utils.js";
import os from "os";

describe("utils", () => {
  describe("stopServer", () => {
    test("returns success when server not running", async () => {
      // Use a port that's unlikely to have a server running
      const result = await stopServer(19999);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Server not running");
    });

    test("returns object with success and message", async () => {
      const result = await stopServer(9222);
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("message");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.message).toBe("string");
    });
  });

  describe("cleanup", () => {
    test("returns success", async () => {
      const result = await cleanup();
      expect(result.success).toBe(true);
    });

    test("returns killed array", async () => {
      const result = await cleanup();
      expect(result).toHaveProperty("killed");
      expect(Array.isArray(result.killed)).toBe(true);
    });

    test("killed array contains strings", async () => {
      const result = await cleanup();
      for (const item of result.killed) {
        expect(typeof item).toBe("string");
      }
    });
  });

  describe("checkXvfb", () => {
    test("returns boolean", () => {
      const result = checkXvfb();
      expect(typeof result).toBe("boolean");
    });

    if (os.platform() === "win32") {
      test("returns false on Windows", () => {
        expect(checkXvfb()).toBe(false);
      });
    }
  });

  describe("buildXvfbCommand", () => {
    test("wraps command with xvfb-run", () => {
      const args = ["node", "cli.js", "server", "--app", "./app"];
      const result = buildXvfbCommand(args);

      expect(result[0]).toBe("xvfb-run");
      expect(result).toContain("--auto-servernum");
      expect(result).toContain("node");
      expect(result).toContain("cli.js");
      expect(result).toContain("server");
    });

    test("includes screen arguments", () => {
      const result = buildXvfbCommand(["test"]);
      const screenArg = result.find((arg) => arg.includes("-screen"));
      expect(screenArg).toBeDefined();
      expect(screenArg).toContain("1920x1080x24");
    });

    test("preserves all original args", () => {
      const args = ["arg1", "arg2", "--flag", "value"];
      const result = buildXvfbCommand(args);

      // All original args should be in the result
      for (const arg of args) {
        expect(result).toContain(arg);
      }
    });
  });
});

describe("setup command structure", () => {
  // We don't actually run setup in tests as it modifies the system
  // Just verify the module exports correctly

  test("setup is a function", async () => {
    const { setup } = await import("./utils.js");
    expect(typeof setup).toBe("function");
  });
});
