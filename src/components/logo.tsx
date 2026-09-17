import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display leading-none tracking-tight text-logo text-balance", className)}>
      Laugh4.LoL
    </span>
  );
}
