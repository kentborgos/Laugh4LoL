import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rememberHouseToken } from "@/lib/jokes/house-middleware";
import {
  getAdminOverview,
  getHouseKeys,
  getJokesterLock,
  saveHouseKeys,
  testPaypalKey,
  testResendKey,
  unlockJokester,
  updateSitePrices,
} from "@/lib/jokes/billing";
import { dollars, parseDollars } from "@/lib/jokes/money";
import { HouseMembers } from "@/components/house-members";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Laugh4.LoL" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AppShell>
      <AdminBody />
    </AppShell>
  );
}

function AdminBody() {
  const [gate, setGate] = useState<"loading" | "locked" | "open">("loading");
  const [password, setPassword] = useState("");
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
  const [busy, setBusy] = useState<"save" | "resend" | "paypal" | "unlock" | "settings" | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const lock = await getJokesterLock();
        if (!lock.unlocked) {
          setGate("locked");
          return;
        }
        await openHouse();
      } catch {
        setGate("locked");
      }
    })();
  }, []);

  async function openHouse() {
    const [overview, keys] = await Promise.all([getAdminOverview(), getHouseKeys()]);
    setTip(dollars(overview.settings.tipPriceCents));
    setRound(dollars(overview.settings.roundPriceCents));
    setDailyAi(String(overview.settings.dailyAi));
    setAdminEmail(overview.settings.adminEmail);
    setStats({
      members: overview.members,
      donations: overview.donations,
      chatsToday: overview.chatsToday,
      resendReady: overview.resendReady,
      paypalReady: overview.paypalReady,
    });
    applyKeys(keys);
  }

  function applyKeys(data: Awaited<ReturnType<typeof getHouseKeys>>) {
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
    setGate("open");
  }

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    setBusy("unlock");
    setError(null);
    try {
      const next = await unlockJokester({ data: { password } });
      rememberHouseToken(next.token);
      setPassword("");
      await openHouse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock.");
    } finally {
      setBusy(null);
    }
  }

  async function onSaveSettings(e: FormEvent) {
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
    setBusy("settings");
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
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(null);
    }
  }

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

  if (gate === "loading") {
    return <div className="h-40 max-w-xl animate-pulse rounded-[var(--radius-xl)] bg-surface" />;
  }

  if (gate === "locked") {
    return (
      <form className="mx-auto grid max-w-md gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5" onSubmit={onUnlock}>
        <h1 className="font-display text-4xl">Backstage</h1>
        <p className="text-sm text-muted">Password only. Nothing on this page is linked from the rest of the house.</p>
        <label className="grid gap-1.5 text-sm font-medium">
          Password
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error ? <p className="text-sm text-adult">{error}</p> : null}
        <Button type="submit" disabled={busy !== null}>
          {busy === "unlock" ? "Checking…" : "Unlock"}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Backstage</h1>
        <p className="mt-2 text-muted text-pretty">
          Suggested PayPal amounts feed the hat. Donations go to kent.borgos22@gmail.com.
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

      <form className="grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5" onSubmit={onSaveSettings}>
        <h2 className="font-display text-2xl">House settings</h2>
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
          <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required autoComplete="email" />
        </label>
        <Button type="submit" disabled={busy !== null}>
          {busy === "settings" ? "Saving…" : "Save settings"}
        </Button>
        {error ? <p className="text-sm text-adult">{error}</p> : null}
        {saved ? <p className="text-sm text-logo-dark">{saved}</p> : null}
      </form>

      <HouseMembers />

      <form className="grid gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-5" onSubmit={onSubmit}>
        <h2 className="font-display text-2xl">House keys</h2>
        <p className="text-sm text-muted">
          Paste Resend and PayPal credentials here. Empty fields keep the previous values.
        </p>
        {status ? (
          <dl className="grid grid-cols-2 gap-3">
            <Tile label="Resend" value={status.resendReady ? "Live" : "Empty"} />
            <Tile label="PayPal REST" value={status.paypalReady ? "Live" : "Empty"} />
          </dl>
        ) : null}
        <h3 className="font-display text-xl">Resend</h3>
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
        <h3 className="mt-2 font-display text-xl">PayPal</h3>
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
