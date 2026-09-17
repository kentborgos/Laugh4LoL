import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ChatStage } from "@/components/chat-stage";
import { getVaultStats } from "@/lib/jokes/server";

export const Route = createFileRoute("/")({
  loader: () => getVaultStats(),
  component: Home,
});

function Home() {
  const stats = Route.useLoaderData();
  return (
    <AppShell>
      <ChatStage initialStats={stats} />
    </AppShell>
  );
}
