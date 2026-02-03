import { requireBrowser, waitForDomStable, waitForInteractive } from "../driver.js";

export interface ClickOptions {
  autoWait?: boolean; // Wait for DOM to stabilize after click (default: true)
  timeout?: number; // Timeout for element to become interactive (default: 5000)
}

export interface ClickResult {
  selector: string;
  success: boolean;
  autoWaited?: boolean;
}

/**
 * Click an element by CSS selector
 * By default, waits for element to be interactive before clicking,
 * and waits for DOM to stabilize after clicking.
 */
export async function click(
  selector: string,
  options: ClickOptions = {}
): Promise<ClickResult> {
  const browser = requireBrowser();
  const autoWait = options.autoWait ?? true;
  const timeout = options.timeout ?? 5000;

  // Wait for element to be interactive
  if (autoWait) {
    await waitForInteractive(selector, timeout);
  }

  const element = await browser.$(selector);

  if (!(await element.isExisting())) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (!(await element.isDisplayed())) {
    throw new Error(`Element not visible: ${selector}`);
  }

  await element.click();

  // Wait for DOM to stabilize after click
  if (autoWait) {
    await waitForDomStable();
  }

  return { selector, success: true, autoWaited: autoWait };
}
