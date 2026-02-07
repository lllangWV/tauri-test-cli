import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import {
  startXvfb,
  stopXvfb,
  checkXvfb,
} from "./commands/utils.js";
import { connect, disconnect, getBrowser } from "./driver.js";

const TEST_APP_PATH = join(
  import.meta.dir,
  "../apps/test-app/src-tauri/target/debug/test-app"
);

/**
 * Verify that native WebDriver takeScreenshot() hangs in Xvfb after
 * DOM changes, and that a JS canvas-based screenshot works instead.
 *
 * WebKit defers painting when running in Xvfb (no display link / vsync).
 * Native takeScreenshot() depends on WebKit's rendering pipeline, so it
 * hangs indefinitely. JS-based screenshots (html2canvas, canvas) bypass
 * the native pipeline and work fine.
 *
 * Requirements: built test app, Xvfb
 */
describe("Xvfb screenshot after DOM change", () => {
  const canRun = existsSync(TEST_APP_PATH) && checkXvfb();

  if (!canRun) {
    test.skip("Requires built test app and Xvfb", () => {});
    return;
  }

  beforeAll(async () => {
    await startXvfb();
    await connect({ appPath: TEST_APP_PATH, waitTimeout: 15000 });
  }, 30000);

  afterAll(async () => {
    await disconnect();
    stopXvfb();
  }, 10000);

  test("native takeScreenshot() hangs after DOM change in Xvfb", async () => {
    const browser = getBrowser()!;
    const TIMEOUT_MS = 5000;

    // Change DOM via JS (simulates SPA navigation)
    await browser.execute(() => {
      document.body.innerHTML =
        "<h1>Navigated</h1><p>Content after SPA navigation</p>";
    });

    // Let WebKit's rendering pipeline go idle
    await new Promise((r) => setTimeout(r, 2000));

    // Native screenshot should hang — WebKit never paints in Xvfb
    let timedOut = false;
    try {
      await Promise.race([
        browser.takeScreenshot(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("screenshot_timeout")),
            TIMEOUT_MS
          )
        ),
      ]);
    } catch (e: any) {
      if (e.message === "screenshot_timeout") {
        timedOut = true;
      } else {
        throw e;
      }
    }

    expect(timedOut).toBe(true);

    // Kill the driver to clear the hung WebDriver session
    // (the pending takeScreenshot blocks all subsequent WebDriver calls)
    await disconnect();
  }, 15000);

  test("JS canvas screenshot succeeds after DOM change in Xvfb", async () => {
    // Fresh driver session (previous was killed to clear hung screenshot)
    await connect({ appPath: TEST_APP_PATH, waitTimeout: 15000 });
    const browser = getBrowser()!;

    // Change DOM via JS
    await browser.execute(() => {
      document.body.innerHTML =
        "<h1>Navigated Again</h1><p>More content after navigation</p>";
    });

    // Let WebKit's rendering pipeline go idle
    await new Promise((r) => setTimeout(r, 2000));

    // JS canvas screenshot bypasses native rendering — should succeed
    const base64: string = await browser.executeAsync(
      (done: (result: string) => void) => {
        try {
          const w = window.innerWidth || 800;
          const h = window.innerHeight || 600;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#000000";
          ctx.font = "24px sans-serif";
          ctx.fillText(document.body.innerText || "empty", 10, 40);
          done(canvas.toDataURL("image/png").substring(22));
        } catch {
          done("");
        }
      }
    );

    expect(base64).toBeTruthy();
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(100);
  }, 30000);
});
