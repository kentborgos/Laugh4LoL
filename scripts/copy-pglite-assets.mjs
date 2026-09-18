#!/usr/bin/env node
/**
 * Nitro's Vercel bundle inlines @electric-sql/pglite but leaves behind the
 * sibling WASM/data files it reads via `new URL("./pglite.data", import.meta.url)`.
 * Without them the serverless function 500s:
 *   ENOENT: no such file or directory, open '/var/task/_libs/pglite.data'
 *
 * Copy them next to the bundled module after `vite build`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules/@electric-sql/pglite/dist");
const FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function pgliteAssetSources(root = ROOT) {
  const src = join(root, "node_modules/@electric-sql/pglite/dist");
  return FILES.map((name) => join(src, name));
}

function collectLibDirs(root) {
  const dirs = [];
  const walk = (dir, depth) => {
    if (depth > 6 || !existsSync(dir)) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.includes("_libs") || dir.endsWith("_libs")) {
      const libs = dir.endsWith("_libs") ? dir : join(dir, "_libs");
      dirs.push(libs);
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git") continue;
      const next = join(dir, name);
      try {
        if (statSync(next).isDirectory()) walk(next, depth + 1);
      } catch {
        /* skip */
      }
    }
  };
  walk(join(root, ".vercel/output"), 0);
  walk(join(root, ".output"), 0);
  return [...new Set(dirs)];
}

export function copyPgliteAssets(root = ROOT) {
  const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
  for (const name of FILES) {
    if (!existsSync(join(srcDir, name))) {
      throw new Error(`missing PGLite asset ${name}`);
    }
  }

  const targets = collectLibDirs(root);
  // Always stage next to a known Vercel function layout even before Nitro writes.
  targets.push(join(root, ".vercel/output/functions/__server.func/_libs"));

  const unique = [...new Set(targets)];
  let copied = 0;
  for (const dir of unique) {
    mkdirSync(dir, { recursive: true });
    for (const name of FILES) {
      copyFileSync(join(srcDir, name), join(dir, name));
      copied += 1;
    }
  }
  return { dirs: unique.length, files: copied };
}

if (process.argv[1]?.includes("copy-pglite-assets")) {
  const result = copyPgliteAssets();
  console.log(
    `[pglite-assets] copied ${FILES.join(", ")} into ${result.dirs} output dir(s)`,
  );
}
