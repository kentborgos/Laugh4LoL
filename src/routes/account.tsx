import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DonateHat } from "@/components/donate-hat";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMembership, getPublicPricing } from "@/lib/jokes/billing";
import { requestVerificationEmail } from "@/lib/jokes/email";
import type { Membership } from "@/lib/jokes/billing.server";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
      </AppShell>
    );
  }
  return (
    <AppShell>
      {user ? <AccountBody /> : <GuestTab />}
    </AppShell>
  );
}

function GuestTab() {
  const [prices, setPrices] = useState<{ tipPriceCents: number; roundPriceCents: number } | null>(null);
  useEffect(() => {
    void getPublicPricing()
      .then((p) => setPrices({ tipPriceCents: p.tipPriceCents, roundPriceCents: p.roundPriceCents }))
      .catch(() => setPrices({ tipPriceCents: 500, roundPriceCents: 2500 }));
  }, []);
  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">The room is free</h1>
        <p className="mt-2 text-muted text-pretty">
          Sign in if you want a tab with Jester Bones. Donations never require an account.
        </p>
        <Button asChild className="mt-4">
          <Link to="/login">Sign in / free account</Link>
        </Button>
      </header>
      <DonateHat tipPriceCents={prices?.tipPriceCents} roundPriceCents={prices?.roundPriceCents} />
    </div>
  );
}

function AccountBody() {
  const [m, setM] = useState<Membership | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void getMembership().then(setM).catch(() => setM(null));
  }, []);

  async function verify() {
    setBusy(true);
    setNote(null);
    try {
      const res = await requestVerificationEmail();
      if (res.already) {
        const next = await getMembership();
        setM(next);
        setNote("Email is already confirmed.");
      } else if (res.previewUrl) {
        setNote("Resend isn't keyed yet — using the preview confirm link.");
        window.location.href = res.previewUrl;
      } else {
        setNote("Confirm letter sent. Check your inbox.");
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not send that letter.");
    } finally {
      setBusy(false);
    }
  }

  if (!m) return <p className="text-sm text-muted">Pulling your tab…</p>;

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Your tab</h1>
        <p className="mt-2 text-muted text-pretty">
          Every account is free. Vault, Hit me, and Jester Bones stay on the house. Tips are
          optional PayPal donations — never a subscription.
        </p>
      </header>

      {!m.emailVerified ? (
        <section className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Confirm this email</h2>
          <p className="mt-2 text-sm text-pretty">
            {m.email ? (
              <>
                Optional, but nice — confirm <span className="font-medium">{m.email}</span> via Resend.
              </>
            ) : (
              "Add an email on this account, then we'll send a Resend letter."
            )}
          </p>
          <Button className="mt-4" disabled={busy} onClick={() => void verify()}>
            {busy ? "Sending…" : "Send confirm letter"}
          </Button>
        </section>
      ) : null}

      <section className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">Current plan</p>
        <p className="font-display text-3xl">Free</p>
        <p className="mt-2 text-sm">
          AI chats today: <span className="tabular-nums font-medium">{m.remainingToday}</span> of{" "}
          <span className="tabular-nums">{m.dailyLimit}</span> left
        </p>
        <p className="mt-1 text-sm text-muted">Email {m.emailVerified ? "confirmed" : "unconfirmed"}</p>
        {m.isAdmin ? (
          <p className="mt-3 flex flex-wrap gap-4">
            <Link to="/admin" className="font-medium text-logo-dark underline-offset-4 hover:underline">
              Open admin
            </Link>
            <Link to="/jokester" className="font-medium text-logo-dark underline-offset-4 hover:underline">
              House keys (/jokester)
            </Link>
          </p>
        ) : null}
      </section>

      <DonateHat tipPriceCents={m.tipPriceCents} roundPriceCents={m.roundPriceCents} />
      {note ? <p className="text-sm text-logo-dark">{note}</p> : null}
    </div>
  );
}
