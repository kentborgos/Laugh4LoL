import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PAYPAL_DONATE_ACTION,
  PAYPAL_DONATE_EMAIL,
  PAYPAL_DONATE_ITEM,
  paypalDonateAmount,
} from "@/lib/jokes/donate";
import { cn } from "@/lib/utils";

type Size = "sm" | "default" | "lg";
type Variant = "default" | "ink" | "outline";

export function DonatePaypalButton({
  amountCents,
  label = "Donate with PayPal",
  variant = "default",
  size = "default",
  className,
}: {
  amountCents?: number;
  label?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  const amount = paypalDonateAmount(amountCents);
  return (
    <form action={PAYPAL_DONATE_ACTION} method="post" target="_blank" className={cn("inline-flex", className)}>
      <input type="hidden" name="cmd" value="_donations" />
      <input type="hidden" name="business" value={PAYPAL_DONATE_EMAIL} />
      <input type="hidden" name="no_recurring" value="1" />
      <input type="hidden" name="item_name" value={PAYPAL_DONATE_ITEM} />
      <input type="hidden" name="currency_code" value="USD" />
      {amount ? <input type="hidden" name="amount" value={amount} /> : null}
      <Button type="submit" variant={variant} size={size} className="w-full">
        <HeartHandshake className="size-4" />
        {label}
      </Button>
    </form>
  );
}
