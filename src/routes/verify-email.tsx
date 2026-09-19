import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { confirmVerification, requestVerificationEmail } from "@/lib/jokes/email";

type Search = { token?: string };

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<"idle" | "checking" | "ok" | "missing" | "expired" | "error">(
    token ? "checking" : "idle",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void confirmVerification({ data: { token } })
      .then((res) => {
        if (!live) return;
        setState(res.ok ? "ok" : res.reason);
      })
      .catch(() => {
        if (live) setState("error");
      });
    return () => {
      live = false;
    };
  }, [token]);

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      const res = await requestVerificationEmail();
      if (res.already) {
        setState("ok");
        return;
      }
      if (res.previewUrl) {
        setPreviewUrl(res.previewUrl);
        setNote("Resend keys aren't set, so here's the confirm link for this preview.");
      } else {
        setNote("Letter's on the way. Check your inbox.");
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not send that letter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-lg gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <h1 className="font-display text-4xl">Confirm your email</h1>
        {state === "checking" ? <p className="text-muted">Checking the velvet rope…</p> : null}
        {state === "ok" ? (
          <>
            <p className="text-pretty">You're on the list. Jester Bones will take your tab seriously now.</p>
            <Button asChild>
              <Link to="/account">Open your tab</Link>
            </Button>
          </>
        ) : null}
        {state === "expired" ? <p className="text-adult">That letter expired. Ask for a fresh one.</p> : null}
        {state === "missing" ? <p className="text-adult">That confirm link didn't match a letter we sent.</p> : null}
        {state === "error" ? <p className="text-adult">The rope jammed. Request a new letter.</p> : null}
        {state === "idle" || state === "expired" || state === "missing" || state === "error" ? (
          <>
            <p className="text-muted text-pretty">
              We send a Resend letter so nobody else can sit in your chair. Confirm it before Jester Bones
              takes the tab. The Stage vault and Hit me stay free.
            </p>
            {isPending ? null : user ? (
              <Button onClick={() => void resend()} disabled={busy}>
                {busy ? "Sending…" : "Send confirm letter"}
              </Button>
            ) : (
              <Button asChild>
                <Link to="/login">Sign in first</Link>
              </Button>
            )}
          </>
        ) : null}
        {previewUrl ? (
          <p className="text-sm text-pretty">
            Preview confirm:{" "}
            <a className="font-medium text-logo-dark underline-offset-4 hover:underline" href={previewUrl}>
              verify this email
            </a>
          </p>
        ) : null}
        {note ? <p className="text-sm text-logo-dark">{note}</p> : null}
      </div>
    </AppShell>
  );
}
