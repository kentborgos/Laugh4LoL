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
  const [tip, setTip] = useState("5.00");
  const [round, setRound] = useState("25.00");
  const [dailyAi, setDailyAi] = useState("80");
  const [adminEmail, setAdminEmail] = useState("");
  const [stats, setStats] = useState<{
    members: number;
    donations: number;
    chatsToday: number;
    resendReady: boolean;
    paypalReady: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    void getAdminOverview()
      .then((data) => {
        setTip(dollars(data.settings.tipPriceCents));
        setRound(dollars(data.settings.roundPriceCents));
        setDailyAi(String(data.settings.dailyAi));
        setAdminEmail(data.settings.adminEmail);
        setStats({
          members: data.members,
          donations: data.donations,
          chatsToday: data.chatsToday,
          resendReady: data.resendReady,
          paypalReady: data.paypalReady,
        });
      })
      .catch(() => setForbidden(true));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tipCents = parseDollars(tip);
    const roundCents = parseDollars(round);
    const daily = Number.parseInt(dailyAi, 10);
    if (tipCents == null || roundCents == null) {
      setError("Donation amounts need to look like money.");
      return;
    }
    if (!Number.isFinite(daily) || daily < 1) {
      setError("Chat cap needs to be a whole number.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await updateSitePrices({
        data: {
          tipPriceCents: tipCents,
          roundPriceCents: roundCents,
          dailyAi: daily,
          adminEmail: adminEmail.trim(),
        },
      });
      setSaved("House settings are up on the board.");
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
          Accounts are free. Set suggested PayPal donation amounts and the daily AI chat cap. Paste
          Resend and PayPal keys at /jokester after the vault password.
        </p>
      </header>

      {stats ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label="Members" value={stats.members} />
          <Tile label="Donations" value={stats.donations} />
          <Tile label="Chats today" value={stats.chatsToday} />
          <Tile label="Resend" value={stats.resendReady ? "On" : "Off"} />
          <Tile label="PayPal" value={stats.paypalReady ? "On" : "Off"} />
        </dl>
      ) : null}

      <form className="grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5" onSubmit={onSubmit}>
        <label className="grid gap-1.5 text-sm font-medium">
          Suggested tip (USD)
          <Input value={tip} onChange={(e) => setTip(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Suggested round (USD)
          <Input value={round} onChange={(e) => setRound(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          AI chats per day
          <Input value={dailyAi} onChange={(e) => setDailyAi(e.target.value)} inputMode="numeric" required />
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
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </form>
      <p>
        <Link to="/jokester" className="font-medium text-logo-dark underline-offset-4 hover:underline">
          Open /jokester house keys
        </Link>
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-3">
      <dt className="text-[0.65rem] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
