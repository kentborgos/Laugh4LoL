import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMembership } from "@/lib/jokes/billing";
import { requestVerificationEmail } from "@/lib/jokes/email";
import { dollars, parseDollars } from "@/lib/jokes/money";
import { finishPaypalCheckout, startPaypalDonation } from "@/lib/jokes/paypal";
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
  const [busy, setBusy] = useState<"tip" | "round" | "custom" | "verify" | "capture" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [custom, setCustom] = useState("10.00");
  const capturing = useRef(false);

  useEffect(() => {
    void getMembership().then(setM).catch(() => setM(null));
  }, []);

  useEffect(() => {
    if (search.paypal === "cancel") {
      setNote("PayPal donation was cancelled. The room is still free.");
      return;
    }
    if (search.paypal !== "return" || !search.token || capturing.current) return;
    capturing.current = true;
    setBusy("capture");
    void finishPaypalCheckout({ data: { orderId: search.token } })
      .then((next) => {
        setM(next);
        setNote("PayPal cleared. Thanks for keeping the lights on — we could all use a little laugh.");
        void navigate({ to: "/account", search: {}, replace: true });
      })
      .catch((err) => {
        setNote(err instanceof Error ? err.message : "PayPal capture missed. Retry from your tab.");
      })
      .finally(() => setBusy(null));
  }, [search.paypal, search.token, navigate]);

  async function donate(amountCents: number, kind: "tip" | "round" | "custom") {
    setBusy(kind);
    setNote(null);
    try {
      const checkout = await startPaypalDonation({ data: { amountCents } });
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

  const donateDisabled = busy !== null || !m.paypalReady;

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Your tab</h1>
        <p className="mt-2 text-muted text-pretty">
          Every account is free. Vault, Hit me, and Jester Bones stay on the house. If you want to
          toss a few bucks in the hat, PayPal donations keep the cigar lit.
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
          <Button className="mt-4" disabled={busy !== null} onClick={() => void verify()}>
            {busy === "verify" ? "Sending…" : "Send confirm letter"}
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
        <p className="mt-1 text-sm text-muted">
          Email {m.emailVerified ? "confirmed" : "unconfirmed"}
          {m.paypalReady ? "" : " · PayPal keys not set"}
        </p>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Tip the hat</h2>
          <p className="mt-1 font-display text-4xl tabular-nums">${dollars(m.tipPriceCents)}</p>
          <p className="mt-2 text-sm text-muted">One-time PayPal donation. No subscription.</p>
          <Button className="mt-4 w-full" disabled={donateDisabled} onClick={() => void donate(m.tipPriceCents, "tip")}>
            {busy === "tip" || busy === "capture" ? "Opening PayPal…" : "Donate with PayPal"}
          </Button>
        </article>
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">Buy a round</h2>
          <p className="mt-1 font-display text-4xl tabular-nums">${dollars(m.roundPriceCents)}</p>
          <p className="mt-2 text-sm text-muted">Bigger one-time tip. Still not a paid seat.</p>
          <Button
            className="mt-4 w-full"
            variant="ink"
            disabled={donateDisabled}
            onClick={() => void donate(m.roundPriceCents, "round")}
          >
            {busy === "round" || busy === "capture" ? "Opening PayPal…" : "Donate with PayPal"}
          </Button>
        </article>
      </div>

      <section className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">Custom amount</h2>
        <p className="mt-2 text-sm text-muted">Any one-time amount from $1 to $1,000.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            aria-label="Custom donation in dollars"
          />
          <Button
            disabled={donateDisabled}
            onClick={() => {
              const cents = parseDollars(custom);
              if (cents == null || cents < 100) {
                setNote("Donation needs to be at least $1.00.");
                return;
              }
              void donate(cents, "custom");
            }}
          >
            {busy === "custom" ? "Opening PayPal…" : "Donate"}
          </Button>
        </div>
      </section>

      {!m.paypalReady ? (
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
