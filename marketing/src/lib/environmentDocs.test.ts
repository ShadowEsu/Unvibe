import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { it } from "node:test";

const marketingRoot = fileURLToPath(new URL("../..", import.meta.url));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(location);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) return [];
    return [location];
  }));
  return nested.flat();
}

it("documents every marketing-specific environment variable", async () => {
  const example = await fs.readFile(path.join(marketingRoot, ".env.example"), "utf8");
  const documented = new Set(
    Array.from(example.matchAll(/^([A-Z0-9_]+)=/gm), (match) => match[1])
  );
  const used = new Set<string>();

  for (const file of await sourceFiles(path.join(marketingRoot, "src"))) {
    const source = await fs.readFile(file, "utf8");
    for (const match of Array.from(source.matchAll(/process\.env\.([A-Z0-9_]+)/g))) used.add(match[1]);
  }

  const missing = Array.from(used)
    .filter((name) => name !== "NODE_ENV" && !documented.has(name))
    .sort();
  assert.deepEqual(missing, [], `Add undocumented variables to marketing/.env.example: ${missing.join(", ")}`);
});
