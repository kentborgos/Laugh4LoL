import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { readAgeToken } from "./age-token";
import { verifyAge, type AgeInput } from "./age.server";
import { maybeCrawl, runCrawl, seedIfEmpty } from "./crawl.server";
import { riffWithGrok } from "./comedian.server";
import type { CrawlRun, CrawlSource, Joke, VaultStats } from "./types";

function isAdult(token?: string | null) {
  return readAgeToken(token)?.adult === true;
}

function mapJoke(row: {
  id: number;
  setup: string;
  punchline: string;
  body: string;
  rating: "clean" | "adult";
  category: string;
  source_name: string;
  source_url: string;
  created_at: string;
}): Joke {
  return {
    id: row.id,
    setup: row.setup,
    punchline: row.punchline,
    body: row.body,
    rating: row.rating,
    category: row.category,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}

export const getVaultStats = createServerFn({ method: "GET" }).handler(async (): Promise<VaultStats> => {
  await seedIfEmpty();
  void maybeCrawl();
  const sql = await getSql();
  const counts = await sql<{ total: number; clean: number; adult: number }>`
    select
      count(*)::int as total,
      count(*) filter (where rating = 'clean')::int as clean,
      count(*) filter (where rating = 'adult')::int as adult
    from jokes
  `;
  const sources = await sql<{ n: number }>`select count(*)::int as n from crawl_sources`;
  const last = await sql<{ finished_at: string | null }>`
    select finished_at from crawl_runs where status = ${"ok"} order by id desc limit 1
  `;
  return {
    total: counts[0]?.total ?? 0,
    clean: counts[0]?.clean ?? 0,
    adult: counts[0]?.adult ?? 0,
    sources: sources[0]?.n ?? 0,
    lastCrawl: last[0]?.finished_at ?? null,
  };
});

const listInput = z.object({
  q: z.string().max(120).optional().default(""),
  category: z.string().max(40).optional().default(""),
  rating: z.enum(["clean", "adult", "all"]).optional().default("all"),
  token: z.string().max(200).optional(),
  offset: z.number().int().min(0).max(5000).optional().default(0),
  limit: z.number().int().min(1).max(48).optional().default(24),
});

export const listJokes = createServerFn({ method: "POST" })
  .validator((input: unknown) => listInput.parse(input))
  .handler(async ({ data }): Promise<{ jokes: Joke[]; total: number; adultUnlocked: boolean }> => {
    await seedIfEmpty();
    const sql = await getSql();
    const adultUnlocked = isAdult(data.token);
    const q = data.q.trim();
    const like = q ? `%${q.replace(/[%_]/g, "")}%` : "";
    const ratingFilter =
      !adultUnlocked || data.rating === "clean" ? "clean" : data.rating === "adult" ? "adult" : null;
    const cat = data.category.trim();

    const rows = await sql<{
      id: number;
      setup: string;
      punchline: string;
      body: string;
      rating: "clean" | "adult";
      category: string;
      source_name: string;
      source_url: string;
      created_at: string;
      full_count: number;
    }>`
      select id, setup, punchline, body, rating, category, source_name, source_url, created_at,
             count(*) over()::int as full_count
      from jokes
      where (${ratingFilter}::text is null or rating = ${ratingFilter})
        and (${cat} = '' or category = ${cat})
        and (${q} = '' or body ilike ${like} or setup ilike ${like} or punchline ilike ${like})
      order by created_at desc, id desc
      limit ${data.limit} offset ${data.offset}
    `;

    return {
      jokes: rows.map(mapJoke),
      total: rows[0]?.full_count ?? 0,
      adultUnlocked,
    };
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ category: string; n: number }>`
    select category, count(*)::int as n from jokes group by category order by n desc, category asc
  `;
  return rows;
});

export const randomJoke = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ token: z.string().max(200).optional(), adultPreferred: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<Joke | null> => {
    await seedIfEmpty();
    const sql = await getSql();
    const adult = isAdult(data.token);
    const wantAdult = adult && data.adultPreferred;
    const rows = wantAdult
      ? await sql<{
          id: number;
          setup: string;
          punchline: string;
          body: string;
          rating: "clean" | "adult";
          category: string;
          source_name: string;
          source_url: string;
          created_at: string;
        }>`select id, setup, punchline, body, rating, category, source_name, source_url, created_at from jokes order by random() limit 1`
      : await sql<{
          id: number;
          setup: string;
          punchline: string;
          body: string;
          rating: "clean" | "adult";
          category: string;
          source_name: string;
          source_url: string;
          created_at: string;
        }>`select id, setup, punchline, body, rating, category, source_name, source_url, created_at from jokes where rating = ${"clean"} order by random() limit 1`;
    return rows[0] ? mapJoke(rows[0]) : null;
  });

export const chatWithJester = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(800),
            }),
          )
          .max(16),
        token: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const adult = isAdult(data.token);
    const result = await riffWithGrok({ messages: data.messages, adult });
    if (result.ok) return { ok: true as const, text: result.text, adult };
    return { ok: true as const, text: result.fallback, adult, notice: result.error };
  });

export const verifyGuestAge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        dob: z.string().max(12),
        idType: z.enum(["state", "passport"]),
        jurisdiction: z.string().min(2).max(56),
        idNumber: z.string().min(5).max(24),
      })
      .parse(input) satisfies AgeInput,
  )
  .handler(async ({ data }) => verifyAge(data));

export const crawlNow = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ force: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => runCrawl(Boolean(data.force)));

export const getCrawlBoard = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const sources = await sql<{
    id: number;
    name: string;
    url: string;
    kind: "api" | "site" | "forum";
    rating: "clean" | "adult";
    last_crawled: string | null;
    last_status: string;
    last_error: string | null;
    enabled: boolean;
  }>`
    select id, name, url, kind, rating, last_crawled, last_status, last_error, enabled
    from crawl_sources
    order by rating asc, name asc
  `;
  const runs = await sql<{
    id: number;
    started_at: string;
    finished_at: string | null;
    found_count: number;
    saved_count: number;
    status: string;
  }>`
    select id, started_at, finished_at, found_count, saved_count, status
    from crawl_runs
    order by id desc
    limit 8
  `;
  return {
    sources: sources.map(
      (s): CrawlSource => ({
        id: s.id,
        name: s.name,
        url: s.url,
        kind: s.kind,
        rating: s.rating,
        lastCrawled: s.last_crawled,
        lastStatus: s.last_status,
        lastError: s.last_error,
        enabled: s.enabled,
      }),
    ),
    runs: runs.map(
      (r): CrawlRun => ({
        id: r.id,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        foundCount: r.found_count,
        savedCount: r.saved_count,
        status: r.status,
      }),
    ),
  };
});
