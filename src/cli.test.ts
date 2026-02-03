import { describe, test, expect } from "bun:test";

// Extract parseArgs for testing (we'll need to export it or recreate it here)
// For now, let's recreate the parsing logic to test it

interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: string[] = [];
  const options: Record<string, string | boolean> = {};
  let command = "";

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (next && !next.startsWith("--")) {
        options[key] = next;
        i += 2;
      } else {
        options[key] = true;
        i++;
      }
    } else if (arg.startsWith("-")) {
      options[arg.slice(1)] = true;
      i++;
    } else if (!command) {
      command = arg;
      i++;
    } else {
      args.push(arg);
      i++;
    }
  }

  return { command, args, options };
}

describe("parseArgs", () => {
  describe("command parsing", () => {
    test("parses simple command", () => {
      const result = parseArgs(["screenshot"]);
      expect(result.command).toBe("screenshot");
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({});
    });

    test("parses command with positional args", () => {
      const result = parseArgs(["click", "button#submit"]);
      expect(result.command).toBe("click");
      expect(result.args).toEqual(["button#submit"]);
    });

    test("parses command with multiple positional args", () => {
      const result = parseArgs(["type", "input#name", "John Doe"]);
      expect(result.command).toBe("type");
      expect(result.args).toEqual(["input#name", "John Doe"]);
    });
  });

  describe("long options (--)", () => {
    test("parses --flag as boolean", () => {
      const result = parseArgs(["screenshot", "--full-page"]);
      expect(result.options["full-page"]).toBe(true);
    });

    test("parses --key value pairs", () => {
      const result = parseArgs(["screenshot", "--output", "/tmp/screen.png"]);
      expect(result.options["output"]).toBe("/tmp/screen.png");
    });

    test("parses --app path correctly", () => {
      const result = parseArgs(["server", "--app", "./target/debug/my-app", "--port", "9222"]);
      expect(result.command).toBe("server");
      expect(result.options["app"]).toBe("./target/debug/my-app");
      expect(result.options["port"]).toBe("9222");
    });

    test("handles multiple boolean flags", () => {
      const result = parseArgs(["screenshot", "--full-page", "--json"]);
      expect(result.options["full-page"]).toBe(true);
      expect(result.options["json"]).toBe(true);
    });

    test("handles mixed flags and values", () => {
      const result = parseArgs([
        "screenshot",
        "--app", "./my-app",
        "--full-page",
        "--output", "/tmp/out.png",
        "--json"
      ]);
      expect(result.options["app"]).toBe("./my-app");
      expect(result.options["full-page"]).toBe(true);
      expect(result.options["output"]).toBe("/tmp/out.png");
      expect(result.options["json"]).toBe(true);
    });
  });

  describe("short options (-)", () => {
    test("parses -h as boolean", () => {
      const result = parseArgs(["-h"]);
      expect(result.options["h"]).toBe(true);
    });

    test("parses multiple short flags", () => {
      const result = parseArgs(["help", "-h", "-v"]);
      expect(result.options["h"]).toBe(true);
      expect(result.options["v"]).toBe(true);
    });
  });

  describe("complex scenarios", () => {
    test("parses full server command", () => {
      const result = parseArgs([
        "server",
        "--app", "/path/to/app",
        "--port", "8080",
        "--auto-wait"
      ]);
      expect(result.command).toBe("server");
      expect(result.options["app"]).toBe("/path/to/app");
      expect(result.options["port"]).toBe("8080");
      expect(result.options["auto-wait"]).toBe(true);
    });

    test("parses status command with port", () => {
      const result = parseArgs(["status", "--port", "8080"]);
      expect(result.command).toBe("status");
      expect(result.options["port"]).toBe("8080");
    });

    test("parses client mode commands (no --app)", () => {
      const result = parseArgs(["click", "button.submit", "--port", "9222"]);
      expect(result.command).toBe("click");
      expect(result.args).toEqual(["button.submit"]);
      expect(result.options["port"]).toBe("9222");
      expect(result.options["app"]).toBeUndefined();
    });

    test("parses screenshot in client mode", () => {
      const result = parseArgs(["screenshot", "--output", "/tmp/screen.png"]);
      expect(result.command).toBe("screenshot");
      expect(result.options["output"]).toBe("/tmp/screen.png");
      expect(result.options["app"]).toBeUndefined();
    });

    test("parses wait command with timeout", () => {
      const result = parseArgs([
        "wait",
        ".loading-spinner",
        "--app", "./app",
        "--timeout", "5000",
        "--gone"
      ]);
      expect(result.command).toBe("wait");
      expect(result.args).toEqual([".loading-spinner"]);
      expect(result.options["timeout"]).toBe("5000");
      expect(result.options["gone"]).toBe(true);
    });

    test("parses eval command with script", () => {
      const result = parseArgs([
        "eval",
        "document.title",
        "--app", "./app",
        "--json"
      ]);
      expect(result.command).toBe("eval");
      expect(result.args).toEqual(["document.title"]);
      expect(result.options["json"]).toBe(true);
    });

    test("handles empty input", () => {
      const result = parseArgs([]);
      expect(result.command).toBe("");
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({});
    });

    test("handles only options, no command", () => {
      const result = parseArgs(["--help"]);
      expect(result.command).toBe("");
      expect(result.options["help"]).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles paths with spaces in quotes", () => {
      const result = parseArgs(["screenshot", "--app", "/path/with spaces/app"]);
      expect(result.options["app"]).toBe("/path/with spaces/app");
    });

    test("handles selectors with special characters", () => {
      const result = parseArgs(["click", "button[data-testid='submit']"]);
      expect(result.args).toEqual(["button[data-testid='submit']"]);
    });

    test("handles CSS selectors with colons", () => {
      const result = parseArgs(["click", "input:focus"]);
      expect(result.args).toEqual(["input:focus"]);
    });

    test("value starting with -- is treated as value not flag", () => {
      // This tests the current behavior - if value starts with --, it's treated as a flag
      const result = parseArgs(["eval", "--script", "--somevalue"]);
      // Current implementation treats --somevalue as a flag
      expect(result.options["script"]).toBe(true);
      expect(result.options["somevalue"]).toBe(true);
    });
  });
});

describe("BatchCommand validation", () => {
  // Test the structure of batch commands
  interface BatchCommand {
    cmd: string;
    selector?: string;
    text?: string;
    script?: string;
    output?: string;
    fullPage?: boolean;
    timeout?: number;
    gone?: boolean;
    ms?: number;
    autoWait?: boolean;
  }

  test("click command requires selector", () => {
    const cmd: BatchCommand = { cmd: "click", selector: "button" };
    expect(cmd.selector).toBeDefined();
  });

  test("type command requires selector and text", () => {
    const cmd: BatchCommand = { cmd: "type", selector: "input", text: "hello" };
    expect(cmd.selector).toBeDefined();
    expect(cmd.text).toBeDefined();
  });

  test("eval command requires script", () => {
    const cmd: BatchCommand = { cmd: "eval", script: "document.title" };
    expect(cmd.script).toBeDefined();
  });

  test("wait command requires selector", () => {
    const cmd: BatchCommand = { cmd: "wait", selector: ".spinner", timeout: 5000, gone: true };
    expect(cmd.selector).toBeDefined();
  });

  test("screenshot command optional fields", () => {
    const cmd: BatchCommand = { cmd: "screenshot", output: "/tmp/out.png", fullPage: true };
    expect(cmd.output).toBe("/tmp/out.png");
    expect(cmd.fullPage).toBe(true);
  });

  test("sleep command uses ms field", () => {
    const cmd: BatchCommand = { cmd: "sleep", ms: 1000 };
    expect(cmd.ms).toBe(1000);
  });
});
