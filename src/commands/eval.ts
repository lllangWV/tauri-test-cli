import { requireBrowser } from "../driver.js";

/**
 * Execute JavaScript in the app context and return the result
 */
export async function evaluate(script: string): Promise<unknown> {
  const browser = requireBrowser();

  // Try simple expression first (e.g. `document.title`, `JSON.stringify(...)`)
  try {
    const result = await browser.execute(`return ${script}`);
    return result;
  } catch {
    // Fall back to IIFE wrapper for multi-statement scripts with their own `return`
    const wrappedScript = `
      return (function() {
        ${script}
      })();
    `;
    const result = await browser.execute(wrappedScript);
    return result;
  }
}
