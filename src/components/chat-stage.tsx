import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { chatWithJester, getVaultStats, randomJoke } from "@/lib/jokes/server";
import { useAge } from "@/lib/jokes/age-store";
import { AgeGate } from "@/components/age-gate";
import type { ChatTurn, VaultStats } from "@/lib/jokes/types";
import { cn } from "@/lib/utils";

const GREET_CLEAN =
  "Name's Jester Bones. Skull, cigar, green hat — house comic for Laugh4.LoL. The vault's filling itself from the web while we talk. Hit me with a topic, a roast request, or just say 'hit me.' We could all use a little laugh.";
const GREET_ADULT =
  "Late show's open. I'm Jester Bones — same skull, hotter material. Dirty jokes are on the table. Keep it adult, keep it funny. What did you laugh for?";

export function ChatStage({ initialStats }: { initialStats?: VaultStats | null }) {
  const { token, adult, ready } = useAge();
  const [gateOpen, setGateOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<VaultStats | null>(initialStats ?? null);
  const [messages, setMessages] = useState<ChatTurn[]>([{ role: "assistant", content: GREET_CLEAN }]);
  const scroller = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  useEffect(() => {
    void getVaultStats().then(setStats);
  }, []);

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
    const next: ChatTurn[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatWithJester({ data: { messages: next, token: token ?? undefined } });
      setMessages([...next, { role: "assistant", content: res.text }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "The mic just ate a cigar ash. Say that again?" },
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
          House comic. Clean room by default. Late show after the ID rope.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Vault" value={stats?.total ?? "—"} />
          <Stat label="Clean" value={stats?.clean ?? "—"} />
          <Stat label="Late" value={adult ? (stats?.adult ?? "—") : "18+"} />
        </dl>
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
