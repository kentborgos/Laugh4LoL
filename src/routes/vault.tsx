import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { VaultBrowser } from "@/components/vault-browser";
import { getVaultStats } from "@/lib/jokes/server";

export const Route = createFileRoute("/vault")({
  loader: () => getVaultStats(),
  component: VaultPage,
});

function VaultPage() {
  return (
    <AppShell>
      <VaultBrowser />
    </AppShell>
  );
}
