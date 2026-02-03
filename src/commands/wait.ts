import { requireBrowser } from "../driver.js";

export interface WaitOptions {
  timeout?: number;
  gone?: boolean;
}

export interface WaitResult {
  selector: string;
  found: boolean;
  elapsed: number;
}

/**
 * Wait for an element to appear or disappear
 */
export async function waitFor(
  selector: string,
  options: WaitOptions = {}
): Promise<WaitResult> {
  const browser = requireBrowser();
  const timeout = options.timeout ?? 5000;
  const start = Date.now();

  const element = await browser.$(selector);

  try {
    if (options.gone) {
      // Wait for element to disappear
      await element.waitForDisplayed({
        timeout,
        reverse: true,
      });
    } else {
      // Wait for element to appear
      await element.waitForDisplayed({ timeout });
    }

    return {
      selector,
      found: !options.gone,
      elapsed: Date.now() - start,
    };
  } catch {
    const elapsed = Date.now() - start;
    if (options.gone) {
      throw new Error(
        `Element still visible after ${elapsed}ms: ${selector}`
      );
    } else {
      throw new Error(
        `Element not found after ${elapsed}ms: ${selector}`
      );
    }
  }
}
