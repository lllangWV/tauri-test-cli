import { writeFile } from "fs/promises";
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

  let data: string;
  let method: string;

  // Try html2canvas first (fast and reliable when it works)
  try {
    data = await withTimeout(
      captureWithHtml2Canvas(browser),
      timeout,
      "html2canvas timed out"
    );
    method = "html2canvas";
  } catch (err) {
    // html2canvas can hang when WebKit throttles rAF (unfocused window on
    // real display, or deferred painting in Xvfb). Fall back to a simple
    // canvas screenshot that doesn't depend on rAF or the rendering pipeline.
    console.error(`html2canvas failed: ${err}, trying canvas fallback...`);
    try {
      data = await withTimeout(
        captureWithCanvas(browser),
        timeout,
        "Canvas screenshot timed out"
      );
      method = "canvas";
    } catch (canvasErr) {
      // In Xvfb, native takeScreenshot() hangs indefinitely after DOM changes
      // (WebKit defers painting with no display link). Don't attempt it.
      if (getXvfbDisplay() !== null) {
        throw new Error(`All screenshot methods failed in Xvfb: html2canvas: ${err}, canvas: ${canvasErr}`);
      }
      // On a real display, native still works as a last resort
      console.error(`Canvas failed: ${canvasErr}, trying native...`);
      try {
        data = await withTimeout(
          browser.takeScreenshot(),
          timeout,
          `Native screenshot timed out after ${timeout}ms`
        );
        method = "native";
      } catch (nativeErr) {
        throw new Error(`All screenshot methods failed: html2canvas: ${err}, canvas: ${canvasErr}, native: ${nativeErr}`);
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
 * Uses execute() + polling instead of executeAsync() because
 * executeAsync hangs after SPA navigation in WebKit/Xvfb.
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

  // Start html2canvas render (fire-and-forget via execute)
  await browser.execute(() => {
    (window as any).__h2cResult = undefined;
    const h2c = (window as any).html2canvas;
    if (!h2c) {
      (window as any).__h2cResult = "";
      return;
    }
    h2c(document.body, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
    })
      .then((canvas: HTMLCanvasElement) => {
        const dataUrl = canvas.toDataURL("image/png");
        (window as any).__h2cResult = dataUrl.replace(/^data:image\/png;base64,/, "");
      })
      .catch(() => {
        (window as any).__h2cResult = "";
      });
    // Internal timeout
    setTimeout(() => {
      if ((window as any).__h2cResult === undefined) {
        (window as any).__h2cResult = "";
      }
    }, 4000);
  });

  // Poll for result
  const base64 = await pollForResult(browser, "__h2cResult");

  if (!base64) {
    throw new Error("html2canvas capture returned empty");
  }

  return base64;
}

/**
 * Simple canvas-based screenshot fallback for Xvfb.
 * Renders the DOM content to a canvas using the browser's own rendering.
 * Uses execute() + polling instead of executeAsync() because
 * executeAsync hangs after SPA navigation in WebKit/Xvfb.
 */
async function captureWithCanvas(browser: any): Promise<string> {
  // Start canvas render (fire-and-forget via execute)
  await browser.execute(() => {
    (window as any).__canvasResult = undefined;
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
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/png");
        (window as any).__canvasResult = dataUrl.replace(/^data:image\/png;base64,/, "");
      };
      img.onerror = () => {
        // SVG foreignObject failed (security restrictions), fall back to text render
        URL.revokeObjectURL(url);
        ctx.fillStyle = "#000000";
        ctx.font = "16px monospace";
        const text = document.body.innerText || "";
        const lines = text.split("\n");
        for (let i = 0; i < lines.length && i < 40; i++) {
          ctx.fillText(lines[i], 10, 20 + i * 20);
        }
        const dataUrl = canvas.toDataURL("image/png");
        (window as any).__canvasResult = dataUrl.replace(/^data:image\/png;base64,/, "");
      };
      img.src = url;

      // Internal timeout
      setTimeout(() => {
        if ((window as any).__canvasResult === undefined) {
          const dataUrl = canvas.toDataURL("image/png");
          (window as any).__canvasResult = dataUrl.replace(/^data:image\/png;base64,/, "");
        }
      }, 4000);
    } catch (e) {
      (window as any).__canvasResult = "";
    }
  });

  // Poll for result
  const base64 = await pollForResult(browser, "__canvasResult");

  if (!base64) {
    throw new Error("Canvas screenshot capture returned empty");
  }

  return base64;
}

/**
 * Poll for a result stored on window[key] by a previously-fired execute().
 * Returns the value once it's no longer undefined.
 */
async function pollForResult(browser: any, key: string, intervalMs = 100, maxMs = 5000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const val = await browser.execute((k: string) => (window as any)[k], key);
    if (val !== undefined) return val;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  // Final check
  const val = await browser.execute((k: string) => (window as any)[k], key);
  return val ?? "";
}
