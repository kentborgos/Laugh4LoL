import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMembership, getPublicPricing } from "@/lib/jokes/billing";
import { requestVerificationEmail } from "@/lib/jokes/email";
import { DonatePaypalButton } from "@/components/donate-button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pricing, setPricing] = useState<{
    tipPriceCents: number;
    roundPriceCents: number;
    dailyAi: number;
  } | null>(null);

  useEffect(() => {
    void getPublicPricing().then(setPricing).catch(() => setPricing(null));
  }, []);

  async function sendToVerify() {
    try {
      await authClient.getSession();
      const verify = await requestVerificationEmail();
      const token = verify.previewUrl ? new URL(verify.previewUrl).searchParams.get("token") : null;
      await navigate({ to: "/verify-email", search: token ? { token } : {} });
    } catch {
      await navigate({ to: "/verify-email", search: {} });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0] || "Guest",
        });
        if (res.error) {
          const msg = res.error.message || "Could not open that tab.";
          setError(
            /invalid origin/i.test(msg)
              ? "This page isn't on a trusted address for sign-up. Open laugh4.lol or the Grok preview and try again."
              : msg,
          );
          return;
        }
        await sendToVerify();
        return;
      }
      const res = await authClient.signIn.email({ email, password });
      if (res.error) {
        const msg = res.error.message || "Email or password didn't land.";
        setError(
          /invalid origin/i.test(msg)
            ? "This page isn't on a trusted address for sign-in. Open laugh4.lol or the Grok preview and try again."
            : msg,
        );
        return;
      }
      await authClient.getSession();
      try {
        const member = await getMembership();
        if (!member.emailVerified) {
          await sendToVerify();
          return;
        }
      } catch {
        await sendToVerify();
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setError("The velvet rope jammed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="stage-spot grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <Link to="/" className="mb-4 flex items-center gap-3">
          <img
            src="/mascot-bust.jpg"
            alt=""
            className="size-12 rounded-[var(--radius-md)] border border-border object-cover object-top"
          />
          <span>
            <Logo className="block text-2xl" />
            <span className="text-xs font-medium tracking-wide text-muted uppercase">House accounts</span>
          </span>
        </Link>
        <h1 className="font-display text-3xl">Pull up a chair</h1>
        <p className="mt-2 text-sm text-muted text-pretty">
          Free tab: {pricing ? `${pricing.dailyAi} AI chats a day` : "a few chats a day"} with Jester Bones.
          Sign in with email and password. Resend sends a confirm letter so the chair is yours. The club is free.
          PayPal donations are optional — they go to kent.borgos22@gmail.com.
        </p>

        {authEnabled ? (
          <>
            <div className="mt-5 mb-3 grid grid-cols-2 gap-2">
              <Button type="button" variant={mode === "in" ? "ink" : "outline"} onClick={() => setMode("in")}>
                Sign in
              </Button>
              <Button type="button" variant={mode === "up" ? "ink" : "outline"} onClick={() => setMode("up")}>
                Free account
              </Button>
            </div>
            <form className="grid gap-3" onSubmit={onSubmit}>
              {mode === "up" ? (
                <label className="grid gap-1.5 text-sm font-medium">
                  Name
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium">
                Email
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Password
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                />
              </label>
              {error ? <p className="text-sm text-adult">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? "Checking the list…" : mode === "up" ? "Open a free tab" : "Sign in"}
              </Button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">Sign-in is disabled.</p>
        )}
        <div className="mt-5 border-t border-border pt-4">
          <DonatePaypalButton className="w-full" label="Donate with PayPal" />
        </div>
      </div>
    </main>
  );
}
