import { describe, test, expect } from "bun:test";
import { stopServer, cleanup, checkXvfb, startXvfb, stopXvfb, getXvfbDisplay } from "./utils.js";
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

  describe("Xvfb management", () => {
    test("getXvfbDisplay returns null when not started", () => {
      // Before starting Xvfb, display should be null
      const display = getXvfbDisplay();
      expect(display === null || typeof display === "number").toBe(true);
    });

    test("stopXvfb is safe to call when not running", () => {
      // Should not throw when Xvfb is not running
      expect(() => stopXvfb()).not.toThrow();
    });

    // Note: We don't test startXvfb in unit tests as it requires
    // Xvfb to be installed and modifies system state. Integration
    // tests should cover that.
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
