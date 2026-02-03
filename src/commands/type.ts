import { requireBrowser, waitForDomStable, waitForInteractive } from "../driver.js";

export interface TypeOptions {
  autoWait?: boolean; // Wait for DOM to stabilize after typing (default: true)
  timeout?: number; // Timeout for element to become interactive (default: 5000)
}

export interface TypeResult {
  selector: string;
  text: string;
  success: boolean;
  autoWaited?: boolean;
}

/**
 * Type text into an element
 * By default, waits for element to be interactive before typing,
 * and waits for DOM to stabilize after typing.
 */
export async function type(
  selector: string,
  text: string,
  options: TypeOptions = {}
): Promise<TypeResult> {
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

  await element.setValue(text);

  // Wait for DOM to stabilize after typing (handles debounced inputs, etc.)
  if (autoWait) {
    await waitForDomStable();
  }

  return { selector, text, success: true, autoWaited: autoWait };
}
