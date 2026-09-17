import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrawlBoard } from "@/components/crawl-board";
import { getCrawlBoard, getVaultStats } from "@/lib/jokes/server";

export const Route = createFileRoute("/crawl")({
  loader: async () => {
    const [board, stats] = await Promise.all([getCrawlBoard(), getVaultStats()]);
    return { board, stats };
  },
  component: CrawlPage,
});

function CrawlPage() {
  return (
    <AppShell>
      <CrawlBoard />
    </AppShell>
  );
}
