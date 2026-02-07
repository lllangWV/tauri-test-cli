import { writeFile } from "fs/promises";
import { execFileSync } from "child_process";
import { requireBrowser, waitForDomStable } from "../driver.js";
import { getXvfbDisplay } from "./utils.js";

export interface ScreenshotOptions {
  output?: string;
  fullPage?: boolean;
  autoWait?: boolean; // Wait for DOM to stabilize before screenshot (default: true)
  timeout?: number; // Timeout in ms (default: 15000)
}

export interface ScreenshotResult {
  path?: string;
  base64?: string;
  width: number;
  height: number;
  autoWaited?: boolean;
  method?: string;
}

const HTML2CANVAS_CDN = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

/**
 * Take a screenshot of the app window
 * Tries html2canvas first (fast), falls back to native with timeout
 */
export async function screenshot(
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  const browser = requireBrowser();
  const autoWait = options.autoWait ?? true;
  const timeout = options.timeout ?? 15000;

  // Wait for DOM to stabilize before taking screenshot
  if (autoWait) {
    await waitForDomStable();
  }

  // Get window size for metadata
  const { width, height } = await browser.getWindowSize();

  let data: string | undefined;
  let method: string | undefined;

  const xvfbDisplay = getXvfbDisplay();

  // In Xvfb, try X11 framebuffer capture first — reads the actual rendered
  // pixels from the virtual display, bypassing all canvas taint / CORS issues.
  if (xvfbDisplay !== null) {
    try {
      data = captureWithX11(xvfbDisplay);
      method = "x11";
    } catch (err) {
      console.error(`X11 capture failed: ${err}, falling back to JS-based methods...`);
    }
  }

  // On a real display, native takeScreenshot() captures the already-rendered
  // pixels (full fidelity, no canvas taint). It only hangs in Xvfb.
  if (!data && xvfbDisplay === null) {
    try {
      data = await withTimeout(
        browser.takeScreenshot(),
        timeout,
        `Native screenshot timed out after ${timeout}ms`
      );
      method = "native";
    } catch (err) {
      console.error(`Native screenshot failed: ${err}, trying html2canvas...`);
    }
  }

  // JS-based fallback chain: html2canvas → canvas
  if (!data) {
    try {
      data = await withTimeout(
        captureWithHtml2Canvas(browser),
        timeout,
        "html2canvas timed out"
      );
      method = "html2canvas";
    } catch (err) {
      console.error(`html2canvas failed: ${err}, trying canvas fallback...`);
      try {
        data = await withTimeout(
          captureWithCanvas(browser),
          timeout,
          "Canvas screenshot timed out"
        );
        method = "canvas";
      } catch (canvasErr) {
        throw new Error(`All screenshot methods failed: ${xvfbDisplay !== null ? "x11 failed, " : ""}html2canvas: ${err}, canvas: ${canvasErr}`);
      }
    }
  }

  if (options.output) {
    const buffer = Buffer.from(data, "base64");
    await writeFile(options.output, buffer);
    console.error(`Screenshot saved to: ${options.output} (method: ${method})`);
    return { path: options.output, width, height, autoWaited: autoWait, method };
  } else {
    return { base64: data, width, height, autoWaited: autoWait, method };
  }
}

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

/**
 * Capture screenshot using html2canvas loaded from CDN.
 * Uses execute() returning a Promise instead of executeAsync() because
 * executeAsync's done() callback hangs after SPA navigation in WebKit/Xvfb.
 * W3C WebDriver resolves Promises returned from execute() natively.
 */
async function captureWithHtml2Canvas(browser: any): Promise<string> {
  // Load html2canvas if not present
  const loaded = await browser.execute((cdnUrl: string) => {
    return new Promise<boolean>((resolve) => {
      if ((window as any).html2canvas) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = cdnUrl;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
      // Timeout for script load
      setTimeout(() => resolve(false), 3000);
    });
  }, HTML2CANVAS_CDN);

  if (!loaded) {
    throw new Error("Failed to load html2canvas from CDN");
  }

  // Small delay to ensure script is ready
  await new Promise((r) => setTimeout(r, 50));

  // Capture using html2canvas — execute() + Promise (not executeAsync)
  const base64 = await browser.execute(() => {
    return new Promise<string>((resolve) => {
      const h2c = (window as any).html2canvas;
      if (!h2c) {
        resolve("");
        return;
      }

      h2c(document.body, {
        useCORS: true,
        allowTaint: false, // false so toDataURL() works (cross-origin images are skipped)
        logging: false,
        backgroundColor: "#ffffff",
      })
        .then((canvas: HTMLCanvasElement) => {
          try {
            const dataUrl = canvas.toDataURL("image/png");
            resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
          } catch {
            resolve("");
          }
        })
        .catch(() => resolve(""));

      // Internal timeout
      setTimeout(() => resolve(""), 4000);
    });
  });

  if (!base64) {
    throw new Error("html2canvas capture returned empty");
  }

  return base64;
}

/**
 * Simple canvas-based screenshot fallback for Xvfb.
 * Renders the DOM content to a canvas using the browser's own rendering.
 * Uses execute() returning a Promise instead of executeAsync().
 */
async function captureWithCanvas(browser: any): Promise<string> {
  const base64 = await browser.execute(() => {
    return new Promise<string>((resolve) => {
      try {
        const w = window.innerWidth || 800;
        const h = window.innerHeight || 600;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        // Serialize DOM to SVG foreignObject and render to canvas
        const serializer = new XMLSerializer();
        const cloned = document.documentElement.cloneNode(true) as HTMLElement;
        const html = serializer.serializeToString(cloned);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <foreignObject width="100%" height="100%">
            ${html}
          </foreignObject>
        </svg>`;

        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        const renderText = () => {
          ctx.fillStyle = "#000000";
          ctx.font = "16px monospace";
          const text = document.body.innerText || "";
          const lines = text.split("\n");
          for (let i = 0; i < lines.length && i < 40; i++) {
            ctx.fillText(lines[i], 10, 20 + i * 20);
          }
          const dataUrl = canvas.toDataURL("image/png");
          resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
        };
        img.onload = () => {
          try {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            const dataUrl = canvas.toDataURL("image/png");
            resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
          } catch {
            // Canvas tainted by cross-origin images in SVG, fall back to text
            URL.revokeObjectURL(url);
            renderText();
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          renderText();
        };
        img.src = url;

        // Internal timeout
        setTimeout(() => {
          try {
            const dataUrl = canvas.toDataURL("image/png");
            resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
          } catch {
            renderText();
          }
        }, 4000);
      } catch (e) {
        resolve("");
      }
    });
  });

  if (!base64) {
    throw new Error("Canvas screenshot capture returned empty");
  }

  return base64;
}

/**
 * Capture screenshot by reading the Xvfb framebuffer directly via ImageMagick.
 * Bypasses all browser JS/canvas security restrictions — renders exactly
 * what's on the virtual display, including cross-origin images.
 */
function captureWithX11(display: number): string {
  const result = execFileSync(
    "import",
    ["-display", `:${display}`, "-window", "root", "png:-"],
    { maxBuffer: 50 * 1024 * 1024, timeout: 10000 }
  );
  return result.toString("base64");
}
