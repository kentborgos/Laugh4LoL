import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/lib/jokes/cookie-consent";

export function CookieBanner() {
  const { choice, ready, choose } = useCookieConsent();
  const open = ready && choice === null;

  if (!ready) return null;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-pref-title"
      aria-describedby="cookie-pref-copy"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-[0_-8px_32px_rgba(26,20,8,0.18)] sm:flex-row sm:items-center sm:p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-logo text-logo-fg">
          <Cookie className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p id="cookie-pref-title" className="font-display text-xl text-ink">
            Save cookies on this stool?
          </p>
          <p id="cookie-pref-copy" className="mt-1 text-sm text-muted text-pretty">
            First visit. Sign-in needs a session cookie either way. Optional cookies remember
            the late-show rope and backstage unlock. We don't sell a thing.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-44">
          <Button type="button" onClick={() => choose("all")}>
            Save cookies
          </Button>
          <Button type="button" variant="outline" onClick={() => choose("necessary")}>
            Necessary only
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  const reopen = useCookieConsent((s) => s.reopen);
  const ready = useCookieConsent((s) => s.ready);
  const choice = useCookieConsent((s) => s.choice);
  if (!ready || choice === null) return null;
  return (
    <button
      type="button"
      onClick={reopen}
      className="text-xs font-medium text-ink underline-offset-4 hover:underline"
    >
      Cookie settings
    </button>
  );
}
