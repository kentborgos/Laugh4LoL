import { useState } from "react";
import { DonatePaypalButton } from "@/components/donate-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYPAL_DONATE_EMAIL } from "@/lib/jokes/donate";
import { dollars, parseDollars } from "@/lib/jokes/money";

export function DonateHat({
  tipPriceCents = 500,
  roundPriceCents = 2500,
}: {
  tipPriceCents?: number;
  roundPriceCents?: number;
}) {
  const [custom, setCustom] = useState("10.00");
  const [customCents, setCustomCents] = useState<number | null>(1000);
  const [note, setNote] = useState<string | null>(null);

  return (
    <section className="grid gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-5">
      <header>
        <h2 className="font-display text-2xl sm:text-3xl">Tip the hat</h2>
        <p className="mt-2 text-sm text-muted text-pretty">
          Laugh4.LoL is free. If you want to keep the cigar lit, PayPal donations go straight to{" "}
          <span className="font-medium text-ink">{PAYPAL_DONATE_EMAIL}</span>. No seats. No
          subscriptions.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[var(--radius-lg)] border border-border bg-bg/40 p-4">
          <p className="font-display text-xl">Tip</p>
          <p className="font-display text-3xl tabular-nums">${dollars(tipPriceCents)}</p>
          <DonatePaypalButton className="mt-3 w-full" amountCents={tipPriceCents} label="Donate with PayPal" />
        </article>
        <article className="rounded-[var(--radius-lg)] border border-border bg-bg/40 p-4">
          <p className="font-display text-xl">Buy a round</p>
          <p className="font-display text-3xl tabular-nums">${dollars(roundPriceCents)}</p>
          <DonatePaypalButton
            className="mt-3 w-full"
            amountCents={roundPriceCents}
            variant="ink"
            label="Donate with PayPal"
          />
        </article>
      </div>
      <div>
        <p className="text-sm font-medium">Custom amount</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const cents = parseDollars(e.target.value);
              setCustomCents(cents != null && cents >= 100 ? cents : null);
              setNote(null);
            }}
            inputMode="decimal"
            aria-label="Custom donation in dollars"
          />
          {customCents ? (
            <DonatePaypalButton className="shrink-0" amountCents={customCents} label="Donate" />
          ) : (
            <Button
              type="button"
              onClick={() => setNote("Donation needs to be at least $1.00.")}
            >
              Donate
            </Button>
          )}
        </div>
        {note ? <p className="mt-2 text-sm text-adult">{note}</p> : null}
      </div>
      <DonatePaypalButton variant="outline" className="w-full sm:w-auto" label="Open PayPal donate" />
    </section>
  );
}
