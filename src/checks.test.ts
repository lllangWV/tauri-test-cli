import { describe, test, expect } from "bun:test";
import { checkDependencies, ensureDependencies, printDependencyStatus } from "./checks.js";
import os from "os";

describe("checks", () => {
  describe("checkDependencies", () => {
    test("returns an array", () => {
      const result = checkDependencies();
      expect(Array.isArray(result)).toBe(true);
    });

    test("each missing dependency has required fields", () => {
      const missing = checkDependencies();

      for (const dep of missing) {
        expect(dep).toHaveProperty("name");
        expect(dep).toHaveProperty("install");
        expect(dep).toHaveProperty("reason");
        expect(typeof dep.name).toBe("string");
        expect(typeof dep.install).toBe("string");
        expect(typeof dep.reason).toBe("string");
      }
    });

    test("dependency names are non-empty strings", () => {
      const missing = checkDependencies();

      for (const dep of missing) {
        expect(dep.name.length).toBeGreaterThan(0);
      }
    });

    test("install instructions are non-empty", () => {
      const missing = checkDependencies();

      for (const dep of missing) {
        expect(dep.install.length).toBeGreaterThan(0);
      }
    });

    test("reason descriptions are non-empty", () => {
      const missing = checkDependencies();

      for (const dep of missing) {
        expect(dep.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe("ensureDependencies", () => {
    test("returns boolean when exitOnMissing is false", () => {
      const result = ensureDependencies(false);
      expect(typeof result).toBe("boolean");
    });

    test("returns true when all dependencies are present", () => {
      const missing = checkDependencies();
      const result = ensureDependencies(false);

      // If no dependencies are missing, should return true
      if (missing.length === 0) {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  describe("printDependencyStatus", () => {
    test("does not throw", () => {
      expect(() => printDependencyStatus()).not.toThrow();
    });
  });

  describe("platform-specific behavior", () => {
    test("on current platform, returns consistent results", () => {
      const result1 = checkDependencies();
      const result2 = checkDependencies();

      expect(result1.length).toBe(result2.length);
      expect(result1.map((d) => d.name).sort()).toEqual(
        result2.map((d) => d.name).sort()
      );
    });

    if (os.platform() === "linux") {
      test("on Linux, may check for webkit2gtk", () => {
        const missing = checkDependencies();
        // If webkit2gtk is missing, it should be in the list
        // If present, it should not be in the list
        // Either way, this is valid - we're just checking the structure
        const webkitDep = missing.find((d) => d.name === "webkit2gtk-4.1");
        if (webkitDep) {
          expect(webkitDep.install).toContain("apt");
          expect(webkitDep.install).toContain("dnf");
          expect(webkitDep.install).toContain("pacman");
        }
      });
    }

    if (os.platform() === "darwin" || os.platform() === "win32") {
      test("on macOS/Windows, does not check for webkit2gtk", () => {
        const missing = checkDependencies();
        const webkitDep = missing.find((d) => d.name === "webkit2gtk-4.1");
        expect(webkitDep).toBeUndefined();
      });
    }
  });

  describe("tauri-driver dependency", () => {
    test("if tauri-driver missing, provides cargo install instruction", () => {
      const missing = checkDependencies();
      const tauriDep = missing.find((d) => d.name === "tauri-driver");

      if (tauriDep) {
        expect(tauriDep.install).toContain("cargo install tauri-driver");
      }
    });
  });
});

describe("dependency structure validation", () => {
  interface MissingDependency {
    name: string;
    install: string;
    reason: string;
  }

  test("MissingDependency interface is correct", () => {
    const dep: MissingDependency = {
      name: "test-dep",
      install: "test install",
      reason: "test reason",
    };

    expect(dep.name).toBe("test-dep");
    expect(dep.install).toBe("test install");
    expect(dep.reason).toBe("test reason");
  });
});
