import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMembership } from "@/lib/jokes/billing";
import { requestVerificationEmail } from "@/lib/jokes/email";
import { dollars } from "@/lib/jokes/money";
import { finishPaypalCheckout, startPaypalCheckout } from "@/lib/jokes/paypal";
import type { Membership } from "@/lib/jokes/billing.server";

type Search = { paypal?: string; token?: string };

export const Route = createFileRoute("/account")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    paypal: typeof s.paypal === "string" ? s.paypal : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
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
  if (!user) return <RedirectToSignIn />;
  return (
    <AppShell>
      <AccountBody />
    </AppShell>
  );
}

function AccountBody() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [m, setM] = useState<Membership | null>(null);
  const [busy, setBusy] = useState<"monthly" | "annual" | "verify" | "capture" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const capturing = useRef(false);

  useEffect(() => {
    void getMembership().then(setM).catch(() => setM(null));
  }, []);

  useEffect(() => {
    if (search.paypal === "cancel") {
      setNote("PayPal checkout was cancelled. Your free tab is still open.");
      return;
    }
    if (search.paypal !== "return" || !search.token || capturing.current) return;
    capturing.current = true;
    setBusy("capture");
    void finishPaypalCheckout({ data: { orderId: search.token } })
      .then((next) => {
        setM(next);
        setNote(
          next.plan === "annual"
            ? "PayPal cleared. That's a year of late-show chats."
            : "PayPal cleared. Monthly membership is on.",
        );
        void navigate({ to: "/account", search: {}, replace: true });
      })
      .catch((err) => {
        setNote(err instanceof Error ? err.message : "PayPal capture missed. Retry from your tab.");
      })
      .finally(() => setBusy(null));
  }, [search.paypal, search.token, navigate]);

  async function pay(plan: "monthly" | "annual") {
    setBusy(plan);
    setNote(null);
    try {
      const checkout = await startPaypalCheckout({ data: { plan } });
      window.location.href = checkout.url;
    } catch (err) {
      setNote(err instanceof Error ? err.message : "PayPal wouldn't open. Try again.");
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
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
      setBusy(null);
    }
  }

  if (!m) return <p className="text-sm text-muted">Pulling your tab…</p>;

  const payDisabled = busy !== null || !m.emailVerified || !m.paypalReady;

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Your tab</h1>
        <p className="mt-2 text-muted text-pretty">
          Free accounts get a short set with the house comic. Paid seats run through PayPal. Confirm your email
          before a paid seat.
        </p>
      </header>

      {!m.emailVerified ? (
        <section className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Confirm this email</h2>
          <p className="mt-2 text-sm text-pretty">
            {m.email ? (
              <>
                We need <span className="font-medium">{m.email}</span> verified via Resend before PayPal will take
                money.
              </>
            ) : (
              "Add an email on this account, then we'll send a Resend letter."
            )}
          </p>
          <Button className="mt-4" disabled={busy !== null} onClick={() => void verify()}>
            {busy === "verify" ? "Sending…" : "Send confirm letter"}
          </Button>
        </section>
      ) : null}

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
        <p className="mt-1 text-sm text-muted">
          Email {m.emailVerified ? "confirmed" : "unconfirmed"}
          {m.paypalReady ? "" : " · PayPal keys not set"}
        </p>
        {m.isAdmin ? (
          <p className="mt-3 flex flex-wrap gap-4">
            <Link to="/admin" className="font-medium text-logo-dark underline-offset-4 hover:underline">
              Open admin (prices)
            </Link>
            <Link to="/jokester" className="font-medium text-logo-dark underline-offset-4 hover:underline">
              House keys (/jokester)
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
          <p className="mt-2 text-sm text-muted">PayPal checkout. Bigger daily chat stack with Jester Bones.</p>
          <Button
            className="mt-4 w-full"
            disabled={payDisabled || (m.paid && m.plan === "monthly")}
            onClick={() => void pay("monthly")}
          >
            {busy === "monthly" || busy === "capture"
              ? "Opening PayPal…"
              : m.paid && m.plan === "monthly"
                ? "Active"
                : "Pay with PayPal"}
          </Button>
        </article>
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Annual</h2>
          <p className="mt-1 font-display text-4xl tabular-nums">
            ${dollars(m.annualPriceCents)}
            <span className="text-base font-sans text-muted"> / yr</span>
          </p>
          <p className="mt-2 text-sm text-muted">Same seat, paid once for the year through PayPal.</p>
          <Button
            className="mt-4 w-full"
            variant="ink"
            disabled={payDisabled || (m.paid && m.plan === "annual")}
            onClick={() => void pay("annual")}
          >
            {busy === "annual" || busy === "capture"
              ? "Opening PayPal…"
              : m.paid && m.plan === "annual"
                ? "Active"
                : "Pay with PayPal"}
          </Button>
        </article>
      </div>
      {!m.emailVerified ? (
        <p className="text-sm text-muted">Confirm your email to unlock PayPal.</p>
      ) : !m.paypalReady ? (
        <p className="text-sm text-muted">
          House PayPal keys aren't in yet.
          {m.isAdmin ? (
            <>
              {" "}
              <Link to="/jokester" className="font-medium text-logo-dark underline-offset-4 hover:underline">
                Add them at /jokester
              </Link>
            </>
          ) : (
            " The house comic will flip the switch."
          )}
        </p>
      ) : null}
      {note ? <p className="text-sm text-logo-dark">{note}</p> : null}
    </div>
  );
}
