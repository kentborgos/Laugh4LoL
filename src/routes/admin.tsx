import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAdminOverview, updateSitePrices } from "@/lib/jokes/billing";
import { dollars, parseDollars } from "@/lib/jokes/money";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <AppShell>
      <AdminBody />
    </AppShell>
  );
}

function AdminBody() {
  const [monthly, setMonthly] = useState("5.99");
  const [annual, setAnnual] = useState("49.99");
  const [freeAi, setFreeAi] = useState("5");
  const [paidAi, setPaidAi] = useState("80");
  const [adminEmail, setAdminEmail] = useState("");
  const [stats, setStats] = useState<{ members: number; paid: number; chatsToday: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    void getAdminOverview()
      .then((data) => {
        setMonthly(dollars(data.settings.monthlyPriceCents));
        setAnnual(dollars(data.settings.annualPriceCents));
        setFreeAi(String(data.settings.freeDailyAi));
        setPaidAi(String(data.settings.paidDailyAi));
        setAdminEmail(data.settings.adminEmail);
        setStats({ members: data.members, paid: data.paid, chatsToday: data.chatsToday });
      })
      .catch(() => setForbidden(true));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const monthlyCents = parseDollars(monthly);
    const annualCents = parseDollars(annual);
    const free = Number.parseInt(freeAi, 10);
    const paid = Number.parseInt(paidAi, 10);
    if (monthlyCents == null || annualCents == null) {
      setError("Prices need to look like money.");
      return;
    }
    if (!Number.isFinite(free) || !Number.isFinite(paid) || free < 1 || paid < 10) {
      setError("Chat caps need to be whole numbers.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await updateSitePrices({
        data: {
          monthlyPriceCents: monthlyCents,
          annualPriceCents: annualCents,
          freeDailyAi: free,
          paidDailyAi: paid,
          adminEmail: adminEmail.trim(),
        },
      });
      setSaved("House prices are up on the board.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-4xl">Backstage is locked</h1>
        <p className="mt-2 text-muted">This room is for the house comic's admin. Use the account that owns the club.</p>
        <Link to="/account" className="mt-4 inline-block font-medium text-logo-dark underline-offset-4 hover:underline">
          Back to your tab
        </Link>
      </div>
    );
  }

  return (
    <div className="grid max-w-xl gap-6">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">House admin</h1>
        <p className="mt-2 text-muted text-pretty">
          Set what a seat costs. Free tabs keep a short daily chat with Jester Bones. Email and
          password run this backstage.
        </p>
      </header>

      {stats ? (
        <dl className="grid grid-cols-3 gap-3">
          <Tile label="Members" value={stats.members} />
          <Tile label="Paid" value={stats.paid} />
          <Tile label="Chats today" value={stats.chatsToday} />
        </dl>
      ) : null}

      <form className="grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5" onSubmit={onSubmit}>
        <label className="grid gap-1.5 text-sm font-medium">
          Monthly price (USD)
          <Input value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Annual price (USD)
          <Input value={annual} onChange={(e) => setAnnual(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Free AI chats per day
          <Input value={freeAi} onChange={(e) => setFreeAi(e.target.value)} inputMode="numeric" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Paid AI chats per day
          <Input value={paidAi} onChange={(e) => setPaidAi(e.target.value)} inputMode="numeric" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Admin email
          <Input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        {error ? <p className="text-sm text-adult">{error}</p> : null}
        {saved ? <p className="text-sm text-logo-dark">{saved}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save prices"}
        </Button>
      </form>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-3">
      <dt className="text-[0.65rem] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
