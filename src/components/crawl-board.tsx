import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crawlNow, getCrawlBoard, getVaultStats } from "@/lib/jokes/server";
import type { CrawlRun, CrawlSource, VaultStats } from "@/lib/jokes/types";
import { cn } from "@/lib/utils";

export function CrawlBoard() {
  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [runs, setRuns] = useState<CrawlRun[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const [board, vault] = await Promise.all([getCrawlBoard(), getVaultStats()]);
    setSources(board.sources);
    setRuns(board.runs);
    setStats(vault);
  }

  const filling = Boolean(stats && !stats.catalogLoaded);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, filling ? 4000 : 20_000);
    return () => window.clearInterval(id);
  }, [filling]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void crawlNow({ data: { force: false } }).then(() => refresh());
    }, 120_000);
    void crawlNow({ data: { force: false } }).then((res) => {
      if (!res.skipped) {
        setNote(`Crawler landed ${res.saved} new bits from ${res.found} finds.`);
        void refresh();
      }
    });
    return () => window.clearInterval(id);
  }, []);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await crawlNow({ data: { force: true } });
      setNote(
        res.skipped
          ? "Crawler just ran. Give it a minute."
          : `Sweep done. Found ${res.found}, saved ${res.saved} new jokes.${
              res.errors.length ? ` ${res.errors.length} sources coughed.` : ""
            }`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">The Crawler</h1>
          <p className="mt-2 max-w-xl text-muted text-pretty">
            Open catalogs first — taivop's 200k dump, SocialGrep's million r/Jokes posts, amoudgl
            short jokes, Wocka, StupidStuff — then live APIs keep the room fresh. Duplicates get
            hashed out. Adult finds stay locked until the ID rope.
          </p>
        </div>
        <Button onClick={() => void run()} disabled={busy}>
          <Radar className={cn("size-4", busy && "animate-spin")} />
          {busy ? "Sweeping…" : "Sweep now"}
        </Button>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Jokes in vault" value={stats ? stats.total.toLocaleString() : "—"} />
        <Tile label="Clean" value={stats ? stats.clean.toLocaleString() : "—"} />
        <Tile label="Late show" value={stats ? stats.adult.toLocaleString() : "—"} />
        <Tile label="Catalog" value={stats ? `${Math.min(100, Math.round((stats.total / Math.max(1, stats.catalogSize)) * 100))}%` : "—"} />
      </dl>
      {note ? <p className="text-sm text-logo-dark">{note}</p> : null}
      {filling ? (
        <p className="text-sm text-muted">
          Pouring the open dumps into the vault — {stats?.total.toLocaleString()} of{" "}
          {stats?.catalogSize.toLocaleString()} unique bits so far.
        </p>
      ) : null}

      <section>
        <h2 className="font-display text-2xl">Live sources</h2>
        <ul className="mt-3 grid gap-3">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {s.name}
                  <span className="ml-2 text-xs font-normal tracking-wide text-muted uppercase">
                    {s.kind} · {s.rating}
                  </span>
                </p>
                <p className="truncate text-xs text-muted">{s.url}</p>
              </div>
              <p
                className={cn(
                  "text-sm font-medium",
                  s.lastStatus === "ok"
                    ? "text-logo-dark"
                    : s.lastStatus === "error"
                      ? "text-adult"
                      : s.lastStatus === "loading"
                        ? "text-logo-dark"
                        : "text-muted",
                )}
              >
                {s.lastStatus === "ok"
                  ? s.name.startsWith("Catalog:")
                    ? "Archived"
                    : "Live"
                  : s.lastStatus === "error"
                    ? s.lastError || "Missed"
                    : s.lastStatus === "loading"
                      ? "Pouring in"
                      : "Waiting"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl">Recent sweeps</h2>
        <ul className="mt-3 grid gap-2">
          {runs.length === 0 ? (
            <li className="text-sm text-muted">No sweeps logged yet. Hit the button — the room wants material.</li>
          ) : (
            runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] bg-surface px-4 py-2 text-sm"
              >
                <span className="tabular-nums text-muted">{new Date(r.startedAt).toLocaleString()}</span>
                <span>
                  found {r.foundCount} · saved {r.savedCount} · {r.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3">
      <dt className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-3xl tabular-nums">{value}</dd>
    </div>
  );
}
