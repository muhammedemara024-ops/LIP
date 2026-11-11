import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  REPO_ROOT,
  assertReadable,
  readRepoFile,
  validateJsonPayload
} from "../../packages/mcp/src/lib.js";

describe("LIP MCP helpers", () => {
  it("reads llms.txt from the repo root", async () => {
    const text = await readRepoFile("llms.txt");
    expect(text).toContain("Loyalty Interchange Protocol");
    expect(text).toContain("npx skills add");
  });

  it("rejects path traversal", () => {
    expect(() => assertReadable("../package.json")).toThrow(/traversal/);
    expect(() => assertReadable("node_modules/foo")).toThrow(/not exposed/);
  });

  it("validates the paid-order fixture", async () => {
    const json = await readFile(`${REPO_ROOT}/spec/examples/paid-order.json`, "utf8");
    const result = validateJsonPayload("FoodserviceOrder", json);
    expect(result.ok).toBe(true);
  });

  it("reports schema validation failures", () => {
    const result = validateJsonPayload("FoodserviceOrder", "{}");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("rejects prototype-inherited schema names and unknown schemas", () => {
    for (const injected of ["__proto__", "constructor", "toString", "valueOf", "UnknownSchema"]) {
      const result = validateJsonPayload(injected, "{}");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe(`Unknown schema: ${injected}`);
      }
    }
  });
});

describe("LIP MCP server factory", () => {
  it("creates a server without throwing", async () => {
    const { createLipMcpServer } = await import("../../packages/mcp/src/server.js");
    expect(createLipMcpServer()).toBeDefined();
  });

  it("identifies direct and symlinked entry-point execution paths across platforms", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join, resolve } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const { isMainModule } = await import("../../packages/mcp/src/server.js");

    const fixtureDir = mkdtempSync(join(tmpdir(), "lip-mcp-fixture-"));
    try {
      const targetDir = join(fixtureDir, "pkg");
      mkdirSync(targetDir, { recursive: true });
      const targetFile = join(targetDir, "server.js");
      writeFileSync(targetFile, "export const loaded = true;");

      const linkDir = join(fixtureDir, "symlink-pkg");
      symlinkSync(targetDir, linkDir, process.platform === "win32" ? "junction" : "dir");
      const linkFile = join(linkDir, "server.js");

      const otherFile = join(fixtureDir, "other.js");
      writeFileSync(otherFile, "export const other = true;");

      const moduleUrl = pathToFileURL(realpathSync(targetFile)).href;

      // 1. Undefined or empty argv returns false
      expect(isMainModule(undefined, moduleUrl)).toBe(false);

      // 2. Direct path execution matches
      expect(isMainModule(targetFile, moduleUrl)).toBe(true);

      // 3. Symlinked/junction path (process.argv[1] pointing to symlink) matches real module URL
      expect(pathToFileURL(resolve(linkFile)).href).not.toBe(moduleUrl);
      expect(isMainModule(linkFile, moduleUrl)).toBe(true);

      // 4. Non-matching file returns false
      expect(isMainModule(otherFile, moduleUrl)).toBe(false);

      // 5. Non-existent file gracefully returns false
      expect(isMainModule(join(fixtureDir, "non-existent.js"), moduleUrl)).toBe(false);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
