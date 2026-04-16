import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".github",
  "tools",
]);

export async function walkYaml(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        await walk(p);
      } else if (e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml"))) {
        out.push(p);
      }
    }
  }
  await walk(root);
  return out.sort();
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export function toRepoRel(root: string, abs: string): string {
  return relative(root, abs) || abs;
}

export function exists(p: string): boolean {
  return existsSync(p);
}
