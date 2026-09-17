import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMembership, subscribePlan } from "@/lib/jokes/billing";
import { dollars } from "@/lib/jokes/money";
import type { Membership } from "@/lib/jokes/billing.server";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
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
      <AccountBody />
    </AppShell>
  );
}

function AccountBody() {
  const [m, setM] = useState<Membership | null>(null);
  const [busy, setBusy] = useState<"monthly" | "annual" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void getMembership().then(setM).catch(() => setM(null));
  }, []);

  async function subscribe(plan: "monthly" | "annual") {
    setBusy(plan);
    setNote(null);
    try {
      const next = await subscribePlan({ data: { plan } });
      setM(next);
      setNote(
        plan === "monthly"
          ? "Monthly membership is on. Jester Bones just loosened the mic."
          : "Annual membership is on. That's a whole year of late-show chats.",
      );
    } catch {
      setNote("Could not start that plan. Sign in again and retry.");
    } finally {
      setBusy(null);
    }
  }

  if (!m) return <p className="text-sm text-muted">Pulling your tab…</p>;

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Your tab</h1>
        <p className="mt-2 text-muted text-pretty">
          Free accounts get a short set with the house comic. Paid seats buy a bigger daily stack.
          Vault browsing and Hit me stay free.
        </p>
      </header>

      <section className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">Current plan</p>
        <p className="font-display text-3xl capitalize">{m.paid ? m.plan : "free"}</p>
        <p className="mt-2 text-sm">
          AI chats today: <span className="tabular-nums font-medium">{m.remainingToday}</span> of{" "}
          <span className="tabular-nums">{m.dailyLimit}</span> left
        </p>
        {m.expiresAt ? (
          <p className="mt-1 text-sm text-muted">Paid through {new Date(m.expiresAt).toLocaleDateString()}</p>
        ) : null}
        {m.isAdmin ? (
          <p className="mt-3">
            <Link to="/admin" className="font-medium text-logo-dark underline-offset-4 hover:underline">
              Open admin (prices)
            </Link>
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Monthly</h2>
          <p className="mt-1 font-display text-4xl tabular-nums">
            ${dollars(m.monthlyPriceCents)}
            <span className="text-base font-sans text-muted"> / mo</span>
          </p>
          <p className="mt-2 text-sm text-muted">A bigger daily chat stack with Jester Bones.</p>
          <Button
            className="mt-4 w-full"
            disabled={busy !== null || (m.paid && m.plan === "monthly")}
            onClick={() => void subscribe("monthly")}
          >
            {busy === "monthly" ? "Opening…" : m.paid && m.plan === "monthly" ? "Active" : "Start monthly"}
          </Button>
        </article>
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Annual</h2>
          <p className="mt-1 font-display text-4xl tabular-nums">
            ${dollars(m.annualPriceCents)}
            <span className="text-base font-sans text-muted"> / yr</span>
          </p>
          <p className="mt-2 text-sm text-muted">Same seat, paid once for the year.</p>
          <Button
            className="mt-4 w-full"
            variant="ink"
            disabled={busy !== null || (m.paid && m.plan === "annual")}
            onClick={() => void subscribe("annual")}
          >
            {busy === "annual" ? "Opening…" : m.paid && m.plan === "annual" ? "Active" : "Start annual"}
          </Button>
        </article>
      </div>
      {note ? <p className="text-sm text-logo-dark">{note}</p> : null}
    </div>
  );
}
