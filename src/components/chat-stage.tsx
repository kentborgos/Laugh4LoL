import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { chatWithJester, getVaultStats, randomJoke } from "@/lib/jokes/server";
import { getMembership, getPublicPricing } from "@/lib/jokes/billing";
import { dollars } from "@/lib/jokes/money";
import { useAge } from "@/lib/jokes/age-store";
import { AgeGate } from "@/components/age-gate";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { ChatTurn, VaultStats } from "@/lib/jokes/types";
import type { Membership } from "@/lib/jokes/billing.server";
import { cn } from "@/lib/utils";

const GREET_CLEAN =
  "Name's Jester Bones. Skull, cigar, green hat — house comic for Laugh4.LoL. The vault's filling itself from the web while we talk. Hit me with a topic, a roast request, or just say 'hit me.' We could all use a little laugh.";
const GREET_ADULT =
  "Late show's open. I'm Jester Bones — same skull, hotter material. Dirty jokes are on the table. Keep it adult, keep it funny. What did you laugh for?";

export function ChatStage({ initialStats }: { initialStats?: VaultStats | null }) {
  const { token, adult, ready } = useAge();
  const { user, isPending } = useCurrentUserState();
  const [gateOpen, setGateOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<VaultStats | null>(initialStats ?? null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pricing, setPricing] = useState<{ monthlyPriceCents: number; freeDailyAi: number } | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([{ role: "assistant", content: GREET_CLEAN }]);
  const scroller = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  useEffect(() => {
    void getVaultStats().then(setStats);
  }, []);

  useEffect(() => {
    if (isPending || !user) {
      setMembership(null);
      void getPublicPricing()
        .then((p) => setPricing({ monthlyPriceCents: p.monthlyPriceCents, freeDailyAi: p.freeDailyAi }))
        .catch(() => setPricing(null));
      return;
    }
    void getMembership().then(setMembership).catch(() => setMembership(null));
  }, [isPending, user]);

  useEffect(() => {
    if (!ready || greeted.current) return;
    greeted.current = true;
    if (adult) setMessages([{ role: "assistant", content: GREET_ADULT }]);
  }, [ready, adult]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!user) return;
    const next: ChatTurn[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatWithJester({ data: { messages: next, token: token ?? undefined } });
      setMessages([...next, { role: "assistant", content: res.text }]);
      if ("remaining" in res) {
        setMembership((m) =>
          m
            ? { ...m, remainingToday: res.remaining, dailyLimit: res.limit, plan: res.plan as Membership["plan"] }
            : m,
        );
      }
    } catch (err) {
      const unauthorized = err instanceof Error && err.message === "Unauthorized";
      setMessages([
        ...next,
        {
          role: "assistant",
          content: unauthorized
            ? "Sign in first — free tab is a few chats a day. Vault jokes are still on the house."
            : "The mic just ate a cigar ash. Say that again?",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function hitMe() {
    setBusy(true);
    try {
      const joke = await randomJoke({ data: { token: token ?? undefined, adultPreferred: adult } });
      const line = joke
        ? joke.setup
          ? `${joke.setup} ${joke.punchline}`
          : joke.body
        : "Vault's empty for a second — crawler's still rummaging.";
      setMessages((m) => [...m, { role: "assistant", content: line }]);
    } finally {
      setBusy(false);
    }
  }

  const signedOut = !isPending && !user;
  const capped = Boolean(membership && membership.remainingToday <= 0);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-3 lg:items-start">
      <aside className="relative min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface p-4">
        <img
          src="/mascot.jpg"
          alt="Jester Bones standing on a yellow stage"
          className="mx-auto h-auto w-full max-h-80 object-contain"
        />
        <p className="mt-3 text-center font-display text-2xl text-logo">Jester Bones</p>
        <p className="mt-1 text-center text-sm text-muted text-pretty">
          House comic. Free tab is a short set. Paid seats get a longer night.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Vault" value={stats?.total ?? "—"} />
          <Stat label="Clean" value={stats?.clean ?? "—"} />
          <Stat label="Late" value={adult ? (stats?.adult ?? "—") : "18+"} />
        </dl>
        {membership ? (
          <p className="mt-3 text-center text-xs text-muted">
            {membership.paid ? "Paid seat" : "Free tab"} ·{" "}
            <span className="tabular-nums">{membership.remainingToday}</span> AI chats left today
            {capped ? (
              <>
                {" · "}
                <Link to="/account" className="font-medium text-logo-dark underline-offset-4 hover:underline">
                  Upgrade
                </Link>
              </>
            ) : null}
          </p>
        ) : signedOut && pricing ? (
          <p className="mt-3 text-center text-xs text-muted">
            Free tab: {pricing.freeDailyAi} AI chats/day · seats from ${dollars(pricing.monthlyPriceCents)}/mo
          </p>
        ) : null}
        <Button className="mt-4 w-full" variant="outline" onClick={() => (adult ? undefined : setGateOpen(true))}>
          {adult ? "Late show unlocked" : "Unlock dirty jokes"}
        </Button>
      </aside>

      <section className="flex min-h-96 min-w-0 flex-col rounded-[var(--radius-xl)] border border-border bg-surface lg:col-span-2 lg:min-h-[32rem]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">The Stage</h1>
            <p className="text-sm text-muted">Full-blown comedian. Not a joke vending machine.</p>
          </div>
          <Button variant="ink" size="sm" onClick={() => void hitMe()} disabled={busy}>
            <Sparkles className="size-4" />
            Hit me
          </Button>
        </div>
        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={`${m.role}-${i}`} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" ? (
                <img
                  src="/mascot-bust.jpg"
                  alt=""
                  className="mt-0.5 size-9 shrink-0 rounded-full border border-border object-cover object-top"
                />
              ) : null}
              <div
                className={cn(
                  "max-w-[min(100%,42rem)] rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm leading-relaxed text-pretty sm:text-base",
                  m.role === "user" ? "bg-ink text-bg" : "bg-surface-2 text-ink",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy ? (
            <p className="pl-12 text-sm text-muted">Jester Bones is lighting the next bit…</p>
          ) : null}
        </div>
        {isPending ? (
          <div className="border-t border-border p-3">
            <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-surface-2" />
          </div>
        ) : signedOut ? (
          <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted text-pretty">
              Open a free tab — a few AI chats a day. Hit me is always on the house.
            </p>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        ) : capped ? (
          <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted text-pretty">
              That's today's free set. Vault and Hit me stay open. A paid seat buys a bigger stack.
            </p>
            <Button asChild>
              <Link to="/account">Upgrade tab</Link>
            </Button>
          </div>
        ) : (
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What did you Laugh For?"
              rows={2}
              className="min-h-12 resize-none"
              suppressHydrationWarning
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        )}
      </section>
      <AgeGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-bg-deep/40 px-2 py-2">
      <dt className="text-[0.65rem] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-xl tabular-nums">{value}</dd>
    </div>
  );
}
