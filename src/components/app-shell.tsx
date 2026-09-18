import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Mic2, Database, Radar, Lock, Unlock, Ticket } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { AgeGate } from "@/components/age-gate";
import { useAge } from "@/lib/jokes/age-store";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMembership } from "@/lib/jokes/billing";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Stage", icon: Mic2 },
  { to: "/vault", label: "Vault", icon: Database },
  { to: "/crawl", label: "Crawler", icon: Radar },
  { to: "/account", label: "Tab", icon: Ticket },
] as const;

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isPending || !user) {
      setIsAdmin(false);
      return;
    }
    void getMembership()
      .then((m) => setIsAdmin(m.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [isPending, user]);

  if (isPending) return <div className="size-8 shrink-0 animate-pulse rounded-full bg-ink/10" />;
  if (user) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        {isAdmin ? (
          <>
            <Link
              to="/admin"
              className="hidden h-9 items-center rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium sm:inline-flex"
            >
              Admin
            </Link>
            <Link
              to="/jokester"
              className="hidden h-9 items-center rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium lg:inline-flex"
            >
              Jokester
            </Link>
          </>
        ) : null}
        <div className="max-w-[10rem] min-w-0 truncate text-ink">
          <UserButton />
        </div>
      </div>
    );
  }
  return (
    <Link
      to="/login"
      className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium"
    >
      Sign in
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { adult, ready, hydrate, clear } = useAge();
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="stage-spot min-h-dvh max-w-full overflow-x-clip text-ink">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/mascot-bust.jpg"
              alt="Jester Bones, skull-faced mascot of Laugh4.LoL"
              className="size-12 shrink-0 rounded-[var(--radius-md)] border border-border object-cover object-top"
            />
            <span className="min-w-0">
              <Logo className="block text-[1.65rem] sm:text-[1.9rem]" />
              <span className="block truncate text-[0.7rem] font-medium tracking-wide text-muted uppercase sm:text-xs">
                We Could All Use A Little Laugh!
              </span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-medium",
                    active ? "bg-logo text-logo-fg" : "text-ink hover:bg-surface-2",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <AuthSlot />
            <Button
              variant={adult ? "adult" : "outline"}
              size="sm"
              onClick={() => {
                if (!ready) return;
                if (adult) clear();
                else setGateOpen(true);
              }}
            >
              {adult ? <Unlock className="size-4" /> : <Lock className="size-4" />}
              <span className="hidden sm:inline">{ready && adult ? "Late show" : "18+"}</span>
            </Button>
          </div>
        </div>
        <nav className="flex border-t border-border/70 lg:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-1.5 text-sm font-medium",
                  active ? "bg-logo text-logo-fg" : "text-ink",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-16">{children}</main>
      <footer className="border-t border-border/70 px-4 py-6 text-center text-sm text-muted">
        <p className="font-medium text-ink">What did you Laugh For?</p>
        <p className="mt-1">Laugh4.LoL · free tab · paid seats · late show 18+</p>
      </footer>
      <AgeGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
}
