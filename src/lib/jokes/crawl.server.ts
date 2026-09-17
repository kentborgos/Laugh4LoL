import { getSql } from "@/lib/db";
import { jokeHash } from "./hash";
import { isUnsafeJoke, splitJoke } from "./filter";
import { SEED_JOKES } from "./seed";
import { CATALOG_MARKER, CATALOG_META, isCatalogSource } from "./catalog";

export type RawJoke = {
  setup: string;
  punchline: string;
  body?: string;
  rating: "clean" | "adult";
  category: string;
  sourceName: string;
  sourceUrl: string;
  score?: number;
};

const UA = "Mozilla/5.0 (compatible; Laugh4.LoL/1.0; +https://laugh4.lol; joke-crawler)";

async function fetchJson(url: string, extra: Record<string, string> = {}, ms = 4500): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...extra },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown) {
  return typeof v === "string" ? v : "";
}

async function fromDadJoke(): Promise<RawJoke[]> {
  const page = 1 + Math.floor(Math.random() * 8);
  const data = asRecord(
    await fetchJson(`https://icanhazdadjoke.com/search?page=${page}&limit=30`, {
      Accept: "application/json",
    }),
  );
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((j) => {
    const rec = asRecord(j) ?? {};
    const joke = str(rec.joke);
    const parts = splitJoke(joke);
    return {
      ...parts,
      rating: "clean" as const,
      category: "dad",
      sourceName: "icanhazdadjoke",
      sourceUrl: rec.id ? `https://icanhazdadjoke.com/j/${str(rec.id)}` : "https://icanhazdadjoke.com/",
      score: 40,
    };
  });
}

async function fromOfficial(): Promise<RawJoke[]> {
  const data = await fetchJson("https://official-joke-api.appspot.com/jokes/ten");
  const list = Array.isArray(data) ? data : [];
  return list.map((j) => {
    const rec = asRecord(j) ?? {};
    const setup = str(rec.setup);
    const punchline = str(rec.punchline);
    return {
      setup,
      punchline,
      body: `${setup} ${punchline}`.trim(),
      rating: "clean" as const,
      category: str(rec.type) || "general",
      sourceName: "Official Joke API",
      sourceUrl: "https://official-joke-api.appspot.com/",
      score: 50,
    };
  });
}

async function fromJokeApi(url: string, rating: "clean" | "adult", name: string): Promise<RawJoke[]> {
  const data = asRecord(await fetchJson(url));
  const jokes = Array.isArray(data?.jokes)
    ? data.jokes
    : data?.joke || data?.setup
      ? [data]
      : [];
  return jokes.map((j) => {
    const rec = asRecord(j) ?? {};
    let setup = str(rec.setup);
    let punchline = str(rec.delivery) || str(rec.joke);
    if (!setup && punchline) {
      const parts = splitJoke(punchline);
      setup = parts.setup;
      punchline = parts.punchline;
    }
    const flags = asRecord(rec.flags);
    const nsfw = Boolean(flags?.nsfw) || Boolean(flags?.explicit) || Boolean(rec.safe === false);
    return {
      setup,
      punchline,
      body: `${setup} ${punchline}`.trim(),
      rating: rating === "adult" || nsfw ? ("adult" as const) : ("clean" as const),
      category: str(rec.category) || "general",
      sourceName: name,
      sourceUrl: "https://v2.jokeapi.dev/",
      score: 35,
    };
  });
}

async function fromReddit(url: string, name: string, fallback: "clean" | "adult"): Promise<RawJoke[]> {
  const data = asRecord(await fetchJson(url, { Accept: "application/json" }));
  const listing = asRecord(data?.data);
  const children = Array.isArray(listing?.children) ? listing.children : [];
  return children.flatMap((child) => {
    const rec = asRecord(asRecord(child)?.data) ?? {};
    const title = str(rec.title).trim();
    const selftext = str(rec.selftext).trim();
    if (!title || rec.stickied) return [];
    if (title.startsWith("[") && title.includes("Removed")) return [];
    const body = selftext ? `${title}\n${selftext}` : title;
    const parts = selftext ? { setup: title, punchline: selftext, body } : splitJoke(title);
    const nsfw = Boolean(rec.over_18);
    const score = typeof rec.score === "number" ? rec.score : Number(rec.score) || 0;
    return [
      {
        ...parts,
        rating: nsfw || fallback === "adult" ? ("adult" as const) : ("clean" as const),
        category: "forum",
        sourceName: name,
        sourceUrl: rec.permalink
          ? `https://www.reddit.com${str(rec.permalink)}`
          : url.replace(".json", ""),
        score,
      },
    ];
  });
}

async function fromChuck(): Promise<RawJoke[]> {
  const out: RawJoke[] = [];
  for (let i = 0; i < 3; i += 1) {
    const rec = asRecord(await fetchJson("https://api.chucknorris.io/jokes/random"));
    const joke = str(rec?.value);
    if (!joke) continue;
    const parts = splitJoke(joke);
    out.push({
      ...parts,
      rating: "clean",
      category: "chuck",
      sourceName: "Chuck Norris API",
      sourceUrl: str(rec?.url) || "https://api.chucknorris.io/",
      score: 20,
    });
  }
  return out;
}

async function harvestSource(name: string, url: string, kind: string, rating: "clean" | "adult"): Promise<RawJoke[]> {
  try {
    if (isCatalogSource(name)) return [];
    if (name === "icanhazdadjoke") return await fromDadJoke();
    if (name === "Official Joke API") return await fromOfficial();
    if (name.startsWith("JokeAPI")) return await fromJokeApi(url, rating, name);
    if (name.startsWith("Reddit")) {
      return await fromReddit(url.replace("www.reddit.com", "old.reddit.com"), name, rating);
    }
    if (name === "Chuck Norris API") return await fromChuck();
    if (kind === "forum") return await fromReddit(url, name, rating);
    return [];
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function insertJokes(batch: RawJoke[]) {
  const sql = await getSql();
  const chunkSize = 60;
  let saved = 0;
  let found = 0;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const slice = batch.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const joke of slice) {
      const body = (joke.body ?? `${joke.setup} ${joke.punchline}`).trim();
      if (body.length < 8 || body.length > 2500) continue;
      found += 1;
      if (isUnsafeJoke(body, joke.rating)) continue;
      const hash = jokeHash(joke.setup, joke.punchline, body);
      placeholders.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
      );
      values.push(
        joke.setup.slice(0, 500),
        joke.punchline.slice(0, 1500),
        body.slice(0, 2500),
        joke.rating,
        joke.category.slice(0, 40),
        joke.sourceName.slice(0, 80),
        joke.sourceUrl.slice(0, 400),
        hash,
        joke.score ?? 0,
      );
    }
    if (!placeholders.length) continue;
    const inserted = await sql.query<{ id: number }>(
      `insert into jokes (setup, punchline, body, rating, category, source_name, source_url, content_hash, score)
       values ${placeholders.join(",")}
       on conflict (content_hash) do nothing
       returning id`,
      values,
    );
    saved += inserted.length;
  }
  return { found, saved };
}

export async function seedIfEmpty() {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from jokes`;
  if ((rows[0]?.n ?? 0) > 0) return { seeded: 0 };

  const seedBatch: RawJoke[] = SEED_JOKES.map((joke) => ({
    setup: joke.setup,
    punchline: joke.punchline,
    body: `${joke.setup} ${joke.punchline}`.trim(),
    rating: joke.rating,
    category: joke.category,
    sourceName: "Laugh4.LoL seed",
    sourceUrl: "",
    score: 90,
  }));
  return { seeded: (await insertJokes(seedBatch)).saved };
}

const globalCatalog = globalThis as typeof globalThis & {
  __laughCatalogLock__?: Promise<{ saved: number; total: number }> | null;
  __laughCatalogDone__?: boolean;
};

export async function importOpenCatalog(): Promise<{ saved: number; total: number; skipped: boolean }> {
  if (globalCatalog.__laughCatalogDone__) {
    return { saved: 0, total: CATALOG_META.count, skipped: true };
  }
  if (globalCatalog.__laughCatalogLock__) return { ...(await globalCatalog.__laughCatalogLock__), skipped: false };

  const job = (async () => {
    const sql = await getSql();
    const existing = await sql<{ n: number }>`
      select count(*)::int as n from jokes where source_name not in (${"Laugh4.LoL seed"})
    `;
    if ((existing[0]?.n ?? 0) >= Math.min(8000, CATALOG_META.count - 200)) {
      globalCatalog.__laughCatalogDone__ = true;
      await sql`
        update crawl_sources
        set last_crawled = now(), last_status = ${"ok"}, last_error = ${null}
        where name like ${"Catalog:%"}
      `;
      return { saved: 0, total: existing[0]?.n ?? 0 };
    }

    await sql`
      update crawl_sources
      set last_status = ${"loading"}, last_error = ${"Importing open joke dumps…"}
      where name = ${CATALOG_MARKER}
    `;

    const { loadCatalogJokes } = await import("./catalog.server");
    const catalog = await loadCatalogJokes();
    let saved = 0;
    const slice = 200;
    for (let i = 0; i < catalog.length; i += slice) {
      const result = await insertJokes(
        catalog.slice(i, i + slice).map((j) => ({
          setup: j.setup,
          punchline: j.punchline,
          body: j.body,
          rating: j.rating,
          category: j.category,
          sourceName: j.sourceName,
          sourceUrl: j.sourceUrl,
          score: j.score,
        })),
      );
      saved += result.saved;
      await new Promise((r) => setTimeout(r, 0));
    }

    await sql`
      update crawl_sources
      set last_crawled = now(), last_status = ${"ok"}, last_error = ${null}
      where name like ${"Catalog:%"}
    `;
    globalCatalog.__laughCatalogDone__ = true;
    return { saved, total: catalog.length };
  })();

  globalCatalog.__laughCatalogLock__ = job;
  try {
    return { ...(await job), skipped: false };
  } catch (err) {
    const sql = await getSql();
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      update crawl_sources
      set last_crawled = now(), last_status = ${"error"}, last_error = ${message.slice(0, 300)}
      where name = ${CATALOG_MARKER}
    `;
    throw err;
  } finally {
    globalCatalog.__laughCatalogLock__ = null;
  }
}

const globalCrawl = globalThis as typeof globalThis & {
  __laughCrawlLock__?: Promise<CrawlResult> | null;
  __laughCrawlAt__?: number;
};

export type CrawlResult = {
  found: number;
  saved: number;
  errors: { source: string; error: string }[];
  skipped: boolean;
};

export async function runCrawl(force = false): Promise<CrawlResult> {
  if (globalCrawl.__laughCrawlLock__) return globalCrawl.__laughCrawlLock__;
  if (!force && globalCrawl.__laughCrawlAt__ && Date.now() - globalCrawl.__laughCrawlAt__ < 8 * 60 * 1000) {
    return { found: 0, saved: 0, errors: [], skipped: true };
  }

  const job = (async () => {
    const sql = await getSql();
    await seedIfEmpty();
    void importOpenCatalog();
    const run = await sql<{ id: number }>`insert into crawl_runs (status) values (${"running"}) returning id`;
    const runId = run[0]?.id;

    const sources = await sql<{
      id: number;
      name: string;
      url: string;
      kind: string;
      rating: "clean" | "adult";
    }>`select id, name, url, kind, rating from crawl_sources where enabled = true`;

    let found = 0;
    let saved = 0;
    const errors: { source: string; error: string }[] = [];

    const harvested = await Promise.allSettled(
      sources.map(async (src) => {
        try {
          const jokes = await harvestSource(src.name, src.url, src.kind, src.rating);
          const result = await insertJokes(jokes);
          if (!isCatalogSource(src.name)) {
            await sql`
              update crawl_sources
              set last_crawled = now(), last_status = ${"ok"}, last_error = ${null}
              where id = ${src.id}
            `;
          }
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await sql`
            update crawl_sources
            set last_crawled = now(), last_status = ${"error"}, last_error = ${message.slice(0, 300)}
            where id = ${src.id}
          `;
          errors.push({ source: src.name, error: message });
          return { found: 0, saved: 0 };
        }
      }),
    );

    for (const item of harvested) {
      if (item.status === "fulfilled") {
        found += item.value.found;
        saved += item.value.saved;
      }
    }

    if (runId) {
      await sql`
        update crawl_runs
        set finished_at = now(), found_count = ${found}, saved_count = ${saved}, status = ${"ok"}
        where id = ${runId}
      `;
    }

    globalCrawl.__laughCrawlAt__ = Date.now();
    return { found, saved, errors, skipped: false };
  })();

  globalCrawl.__laughCrawlLock__ = job;
  try {
    return await job;
  } finally {
    globalCrawl.__laughCrawlLock__ = null;
  }
}

export async function maybeCrawl() {
  await seedIfEmpty();
  void importOpenCatalog();
  const sql = await getSql();
  const last = await sql<{ finished_at: string | null }>`
    select finished_at from crawl_runs where status = ${"ok"} order by id desc limit 1
  `;
  const finished = last[0]?.finished_at;
  if (finished && Date.now() - new Date(finished).getTime() < 10 * 60 * 1000) return { skipped: true as const };
  return runCrawl(false);
}
