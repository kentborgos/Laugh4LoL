import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgeGate } from "@/components/age-gate";
import { listCategories, listJokes } from "@/lib/jokes/server";
import { useAge } from "@/lib/jokes/age-store";
import type { Joke } from "@/lib/jokes/types";
import { cn } from "@/lib/utils";

export function VaultBrowser() {
  const { token, adult } = useAge();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState<"all" | "clean" | "adult">("all");
  const [jokes, setJokes] = useState<Joke[]>([]);
  const [total, setTotal] = useState(0);
  const [cats, setCats] = useState<{ category: string; n: number }[]>([]);
  const [busy, setBusy] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 220);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void listCategories().then(setCats);
  }, []);

  useEffect(() => {
    let live = true;
    setBusy(true);
    void listJokes({
      data: {
        q: debounced,
        category,
        rating: adult ? rating : "clean",
        token: token ?? undefined,
        offset: 0,
        limit: 36,
      },
    })
      .then((res) => {
        if (!live) return;
        setJokes(res.jokes);
        setTotal(res.total);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [debounced, category, rating, token, adult]);

  const shownCats = useMemo(() => cats.slice(0, 14), [cats]);

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="font-display text-4xl sm:text-5xl">The Vault</h1>
        <p className="max-w-2xl text-muted text-pretty">
          A living joke database. The crawler keeps pulling clean and late-show bits from public
          APIs and forums. {total.toLocaleString()} bits on the floor
          {adult ? "" : " — adult cards stay locked until you pass the ID rope"}.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search setups, punchlines, topics…"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["all", "clean", "adult"] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={rating === r ? (r === "adult" ? "adult" : "ink") : "outline"}
              onClick={() => {
                if (r === "adult" && !adult) {
                  setGateOpen(true);
                  return;
                }
                setRating(r);
              }}
            >
              {r === "adult" && !adult ? <Lock className="size-3.5" /> : null}
              {r === "all" ? "All I can see" : r === "clean" ? "Clean" : "Late show"}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!category} onClick={() => setCategory("")}>
            Every category
          </Chip>
          {shownCats.map((c) => (
            <Chip key={c.category} active={category === c.category} onClick={() => setCategory(c.category)}>
              {c.category} · {c.n}
            </Chip>
          ))}
        </div>
      </div>

      {busy && !jokes.length ? (
        <p className="text-sm text-muted">Pulling the file cabinets…</p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {jokes.map((joke) => (
          <li
            key={joke.id}
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">
                {joke.category}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase",
                  joke.rating === "adult" ? "bg-adult text-adult-fg" : "bg-logo/15 text-logo-dark",
                )}
              >
                {joke.rating === "adult" ? "18+" : "clean"}
              </span>
            </div>
            {joke.setup ? (
              <>
                <p className="font-medium text-pretty">{joke.setup}</p>
                <p className="mt-2 text-pretty">{joke.punchline}</p>
              </>
            ) : (
              <p className="text-pretty">{joke.body}</p>
            )}
            <p className="mt-3 truncate text-xs text-muted">{joke.sourceName}</p>
          </li>
        ))}
      </ul>
      {!busy && !jokes.length ? (
        <p className="text-muted">No bits matched. The crawler might still be warming the room.</p>
      ) : null}
      <AgeGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3 text-xs font-medium",
        active ? "bg-ink text-bg" : "bg-surface-2 text-ink hover:bg-bg-deep/50",
      )}
    >
      {children}
    </button>
  );
}
