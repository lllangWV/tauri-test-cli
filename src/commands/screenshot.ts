import { writeFile } from "fs/promises";
import { requireBrowser, waitForDomStable } from "../driver.js";

export interface ScreenshotOptions {
  output?: string;
  fullPage?: boolean;
  autoWait?: boolean; // Wait for DOM to stabilize before screenshot (default: true)
  timeout?: number; // Timeout in ms (default: 5000)
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
  const timeout = options.timeout ?? 5000;

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
    console.error(`html2canvas failed: ${err}, trying native...`);
    // Fall back to native with timeout
    try {
      data = await withTimeout(
        browser.takeScreenshot(),
        timeout,
        `Native screenshot timed out after ${timeout}ms`
      );
      method = "native";
    } catch (nativeErr) {
      throw new Error(`All screenshot methods failed: ${err}, ${nativeErr}`);
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
 * Capture screenshot using html2canvas loaded from CDN
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

  // Capture using html2canvas
  const base64 = await browser.executeAsync((done: (result: string) => void) => {
    const h2c = (window as any).html2canvas;
    if (!h2c) {
      done("");
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
        done(dataUrl.replace(/^data:image\/png;base64,/, ""));
      })
      .catch(() => done(""));

    // Internal timeout
    setTimeout(() => done(""), 4000);
  });

  if (!base64) {
    throw new Error("html2canvas capture returned empty");
  }

  return base64;
}
