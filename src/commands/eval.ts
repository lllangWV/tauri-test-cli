import { requireBrowser } from "../driver.js";

/**
 * Execute JavaScript in the app context and return the result
 */
export async function evaluate(script: string): Promise<unknown> {
  const browser = requireBrowser();

  // Wrap in a function to allow return statements
  const wrappedScript = `
    return (function() {
      ${script}
    })();
  `;

  try {
    const result = await browser.execute(wrappedScript);
    return result;
  } catch (err) {
    // Try without wrapping (for simple expressions)
    try {
      const result = await browser.execute(`return ${script}`);
      return result;
    } catch {
      throw err;
    }
  }
}
