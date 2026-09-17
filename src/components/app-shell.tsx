import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Mic2, Database, Radar, Lock, Unlock } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { AgeGate } from "@/components/age-gate";
import { useAge } from "@/lib/jokes/age-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Stage", icon: Mic2 },
  { to: "/vault", label: "Vault", icon: Database },
  { to: "/crawl", label: "Crawler", icon: Radar },
] as const;

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
          <nav className="ml-auto hidden items-center gap-1 md:flex">
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
          <Button
            variant={adult ? "adult" : "outline"}
            size="sm"
            className="ml-auto md:ml-2"
            onClick={() => {
              if (adult) clear();
              else setGateOpen(true);
            }}
          >
            {adult ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            <span className="hidden sm:inline">{ready && adult ? "Late show" : "18+ gate"}</span>
          </Button>
        </div>
        <nav className="flex border-t border-border/70 md:hidden">
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
        <p className="mt-1">Laugh4.LoL · clean room always open · late show 18+ with ID check</p>
      </footer>
      <AgeGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
}
