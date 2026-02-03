import { writeFile } from "fs/promises";
import { requireBrowser, waitForDomStable } from "../driver.js";

export interface SnapshotOptions {
  output?: string;
  autoWait?: boolean; // Wait for DOM to stabilize before snapshot (default: true)
}

interface ElementNode {
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  attributes: Record<string, string>;
  children: ElementNode[];
}

/**
 * Get DOM snapshot as a simplified accessibility tree
 * Similar to Playwright's getAISnapshot / ARIA snapshot
 * By default, waits for DOM to stabilize before capturing.
 */
export async function snapshot(options: SnapshotOptions = {}): Promise<string> {
  const browser = requireBrowser();
  const autoWait = options.autoWait ?? true;

  // Wait for DOM to stabilize before taking snapshot
  if (autoWait) {
    await waitForDomStable();
  }

  // Execute script to build accessibility-like tree
  const tree = await browser.execute(() => {
    function getRole(el: Element): string {
      // Check explicit role
      const role = el.getAttribute("role");
      if (role) return role;

      // Infer from tag
      const tag = el.tagName.toLowerCase();
      const roleMap: Record<string, string> = {
        button: "button",
        a: "link",
        input: "textbox",
        select: "combobox",
        textarea: "textbox",
        img: "img",
        nav: "navigation",
        main: "main",
        header: "banner",
        footer: "contentinfo",
        aside: "complementary",
        article: "article",
        section: "region",
        form: "form",
        ul: "list",
        ol: "list",
        li: "listitem",
        table: "table",
        tr: "row",
        td: "cell",
        th: "columnheader",
        h1: "heading",
        h2: "heading",
        h3: "heading",
        h4: "heading",
        h5: "heading",
        h6: "heading",
        dialog: "dialog",
      };
      return roleMap[tag] || tag;
    }

    function getAccessibleName(el: Element): string {
      // aria-label
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;

      // aria-labelledby
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.textContent?.trim() || "";
      }

      // For inputs, check associated label
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const id = el.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return label.textContent?.trim() || "";
        }
      }

      // alt text for images
      if (el instanceof HTMLImageElement) {
        return el.alt || "";
      }

      // Button/link text
      if (
        el instanceof HTMLButtonElement ||
        el instanceof HTMLAnchorElement
      ) {
        return el.textContent?.trim() || "";
      }

      return "";
    }

    function buildTree(el: Element, depth = 0): any {
      if (depth > 10) return null; // Prevent infinite recursion

      const role = getRole(el);
      const name = getAccessibleName(el);
      const tag = el.tagName.toLowerCase();

      // Skip script, style, hidden elements
      if (["script", "style", "noscript"].includes(tag)) return null;
      if (el instanceof HTMLElement && el.hidden) return null;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return null;

      // Get relevant attributes
      const attrs: Record<string, string> = {};
      const relevantAttrs = [
        "id",
        "class",
        "type",
        "name",
        "value",
        "placeholder",
        "href",
        "src",
        "disabled",
        "checked",
        "selected",
        "aria-expanded",
        "aria-pressed",
        "aria-checked",
        "data-testid",
      ];
      for (const attr of relevantAttrs) {
        const val = el.getAttribute(attr);
        if (val) attrs[attr] = val;
      }

      // Get text content (only direct text, not from children)
      let text = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent?.trim();
          if (t) text += t + " ";
        }
      }
      text = text.trim();

      // Build children
      const children: any[] = [];
      for (const child of el.children) {
        const childNode = buildTree(child, depth + 1);
        if (childNode) children.push(childNode);
      }

      // Skip empty container elements
      if (!name && !text && children.length === 0 && !["img", "input", "textarea", "select"].includes(tag)) {
        return null;
      }

      return {
        role,
        name: name || undefined,
        text: text || undefined,
        attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        children: children.length > 0 ? children : undefined,
      };
    }

    return buildTree(document.body);
  });

  // Convert to YAML-like format
  const yaml = toYaml(tree, 0);

  if (options.output) {
    await writeFile(options.output, yaml);
    console.error(`Snapshot saved to: ${options.output}`);
  }

  return yaml;
}

function toYaml(node: any, indent: number): string {
  if (!node) return "";

  const spaces = "  ".repeat(indent);
  let line = `${spaces}- ${node.role}`;

  if (node.name) {
    line += ` "${node.name}"`;
  }

  // Add key attributes inline
  const inlineAttrs: string[] = [];
  if (node.attrs?.id) inlineAttrs.push(`#${node.attrs.id}`);
  if (node.attrs?.class) {
    const classes = node.attrs.class.split(" ").slice(0, 2).join(".");
    if (classes) inlineAttrs.push(`.${classes}`);
  }
  if (node.attrs?.type) inlineAttrs.push(`[type=${node.attrs.type}]`);
  if (node.attrs?.disabled !== undefined) inlineAttrs.push("[disabled]");
  if (node.attrs?.checked !== undefined) inlineAttrs.push("[checked]");

  if (inlineAttrs.length > 0) {
    line += ` ${inlineAttrs.join("")}`;
  }

  if (node.text && !node.name) {
    // Truncate long text
    const text = node.text.length > 50 ? node.text.slice(0, 50) + "..." : node.text;
    line += `: "${text}"`;
  }

  let result = line + "\n";

  if (node.children) {
    for (const child of node.children) {
      result += toYaml(child, indent + 1);
    }
  }

  return result;
}
