import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getHouseKeys, saveHouseKeys, testPaypalKey, testResendKey } from "@/lib/jokes/billing";

export const Route = createFileRoute("/jokester")({ component: JokesterPage });

function JokesterPage() {
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
      <JokesterBody />
    </AppShell>
  );
}

function JokesterBody() {
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState("Laugh4.LoL <onboarding@resend.dev>");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalMode, setPaypalMode] = useState<"sandbox" | "live">("sandbox");
  const [paypalWebhookId, setPaypalWebhookId] = useState("");
  const [hints, setHints] = useState({ resend: "", paypalId: "", paypalSecret: "", webhook: "" });
  const [status, setStatus] = useState<{ resendReady: boolean; paypalReady: boolean; env: { resend: boolean; paypal: boolean } } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "resend" | "paypal" | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    void getHouseKeys()
      .then((data) => {
        setResendFromEmail(data.resendFromEmail);
        setPaypalMode(data.paypalMode);
        setHints({
          resend: data.resendApiKeyHint,
          paypalId: data.paypalClientIdHint,
          paypalSecret: data.paypalReady ? "••••saved" : "",
          webhook: data.paypalWebhookIdHint,
        });
        setStatus({
          resendReady: data.resendReady,
          paypalReady: data.paypalReady,
          env: data.envOverrides,
        });
      })
      .catch(() => setForbidden(true));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setSaved(null);
    try {
      const next = await saveHouseKeys({
        data: {
          resendApiKey: resendApiKey || undefined,
          resendFromEmail,
          paypalClientId: paypalClientId || undefined,
          paypalClientSecret: paypalClientSecret || undefined,
          paypalMode,
          paypalWebhookId: paypalWebhookId || undefined,
        },
      });
      setStatus((s) => (s ? { ...s, resendReady: next.resendReady, paypalReady: next.paypalReady } : s));
      setHints({
        resend: next.resendApiKeyHint,
        paypalId: next.paypalClientIdHint,
        paypalSecret: next.paypalReady ? "••••saved" : "",
        webhook: paypalWebhookId ? "••••saved" : hints.webhook,
      });
      setResendApiKey("");
      setPaypalClientId("");
      setPaypalClientSecret("");
      setPaypalWebhookId("");
      setSaved("House keys are in the vault. Empty fields kept the previous values.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save keys.");
    } finally {
      setBusy(null);
    }
  }

  async function testResend() {
    setBusy("resend");
    setError(null);
    setSaved(null);
    try {
      const r = await testResendKey();
      setSaved(`Resend sent a test letter to ${r.to}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resend test failed.");
    } finally {
      setBusy(null);
    }
  }

  async function testPaypal() {
    setBusy("paypal");
    setError(null);
    setSaved(null);
    try {
      const r = await testPaypalKey();
      setSaved(`PayPal answered. Mode: ${r.mode}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PayPal test failed.");
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-4xl">Jokester is locked</h1>
        <p className="mt-2 text-muted">House keys stay backstage. Sign in as admin.</p>
        <Link to="/account" className="mt-4 inline-block font-medium text-logo-dark underline-offset-4 hover:underline">
          Back to your tab
        </Link>
      </div>
    );
  }

  return (
    <div className="grid max-w-xl gap-6">
      <header>
        <p className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">House keys</p>
        <h1 className="font-display text-4xl sm:text-5xl">/jokester</h1>
        <p className="mt-2 text-muted text-pretty">
          Paste Resend and PayPal credentials here. The app reads them server-side — never from the browser.
          Vercel env vars override these if both are set.
        </p>
      </header>

      {status ? (
        <dl className="grid grid-cols-2 gap-3">
          <Tile label="Resend" value={status.resendReady ? "Live" : "Empty"} />
          <Tile label="PayPal" value={status.paypalReady ? "Live" : "Empty"} />
        </dl>
      ) : null}

      <form className="grid gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-5" onSubmit={onSubmit}>
        <h2 className="font-display text-2xl">Resend</h2>
        <p className="text-sm text-muted">API key from resend.com. From-address needs a verified domain, or use onboarding@resend.dev.</p>
        <label className="grid gap-1.5 text-sm font-medium">
          API key
          <Input
            type="password"
            autoComplete="off"
            value={resendApiKey}
            onChange={(e) => setResendApiKey(e.target.value)}
            placeholder={hints.resend || "re_••••"}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          From email
          <Input value={resendFromEmail} onChange={(e) => setResendFromEmail(e.target.value)} required />
        </label>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void testResend()}>
          {busy === "resend" ? "Sending…" : "Send test letter"}
        </Button>

        <h2 className="mt-2 font-display text-2xl">PayPal</h2>
        <p className="text-sm text-muted">REST app from developer.paypal.com. Sandbox for rehearsal, Live for the door.</p>
        <label className="grid gap-1.5 text-sm font-medium">
          Mode
          <select
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-base"
            value={paypalMode}
            onChange={(e) => setPaypalMode(e.target.value === "live" ? "live" : "sandbox")}
          >
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Client ID
          <Input
            autoComplete="off"
            value={paypalClientId}
            onChange={(e) => setPaypalClientId(e.target.value)}
            placeholder={hints.paypalId || "Client ID"}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Secret
          <Input
            type="password"
            autoComplete="off"
            value={paypalClientSecret}
            onChange={(e) => setPaypalClientSecret(e.target.value)}
            placeholder={hints.paypalSecret || "Secret"}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Webhook ID (optional)
          <Input
            autoComplete="off"
            value={paypalWebhookId}
            onChange={(e) => setPaypalWebhookId(e.target.value)}
            placeholder={hints.webhook || "Webhook ID"}
          />
        </label>
        <p className="text-xs text-muted">Webhook URL: /api/paypal/webhook — return capture still works without it.</p>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void testPaypal()}>
          {busy === "paypal" ? "Pinging…" : "Ping PayPal"}
        </Button>

        {status?.env.resend || status?.env.paypal ? (
          <p className="text-sm text-logo-dark">
            Env vars are set{status.env.resend ? " (Resend)" : ""}
            {status.env.paypal ? " (PayPal)" : ""}. Those win over this form.
          </p>
        ) : null}
        {error ? <p className="text-sm text-adult">{error}</p> : null}
        {saved ? <p className="text-sm text-logo-dark">{saved}</p> : null}
        <Button type="submit" disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save house keys"}
        </Button>
      </form>
      <p>
        <Link to="/admin" className="font-medium text-logo-dark underline-offset-4 hover:underline">
          Back to house admin
        </Link>
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-3">
      <dt className="text-[0.65rem] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-2xl">{value}</dd>
    </div>
  );
}
