import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

export type CatalogJoke = {
  setup: string;
  punchline: string;
  body: string;
  rating: "clean" | "adult";
  category: string;
  sourceName: string;
  sourceUrl: string;
  score: number;
};

async function readGzip(): Promise<Buffer> {
  const candidates = [
    join(process.cwd(), "public/jokes/vault.jsonl.gz"),
    join(process.cwd(), "src/lib/jokes/catalog/vault.jsonl.gz"),
    join(process.cwd(), "jokes/vault.jsonl.gz"),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path);
    } catch {
      /* try next */
    }
  }

  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://127.0.0.1:8080";
  const res = await fetch(`${origin}/jokes/vault.jsonl.gz`);
  if (!res.ok) throw new Error(`joke catalog missing (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

let cached: CatalogJoke[] | null = null;
let loading: Promise<CatalogJoke[]> | null = null;

export async function loadCatalogJokes(): Promise<CatalogJoke[]> {
  if (cached) return cached;
  if (loading) return loading;
  loading = (async () => {
    const buf = await readGzip();
    const text = gunzipSync(buf).toString("utf8");
    const rows: CatalogJoke[] = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      let raw: {
        s?: string;
        p?: string;
        b?: string;
        r?: string;
        c?: string;
        n?: string;
        u?: string;
        k?: number;
      };
      try {
        raw = JSON.parse(line) as typeof raw;
      } catch {
        continue;
      }
      const body = (raw.b || `${raw.s ?? ""} ${raw.p ?? ""}`).trim();
      if (body.length < 8) continue;
      const sourceName = raw.n || "open catalog";
      const redditDump = sourceName.startsWith("r/Jokes (");
      rows.push({
        setup: raw.s ?? "",
        punchline: raw.p ?? "",
        body,
        rating: raw.r === "a" || redditDump ? "adult" : "clean",
        category: raw.c || "general",
        sourceName,
        sourceUrl: raw.u || "",
        score: Number(raw.k) || 0,
      });
    }
    cached = rows;
    return rows;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}
