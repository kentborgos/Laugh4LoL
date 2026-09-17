import { createFileRoute } from "@tanstack/react-router";
import { runCrawl, seedIfEmpty } from "@/lib/jokes/crawl.server";

export const Route = createFileRoute("/api/crawl")({
  server: {
    handlers: {
      GET: async () => {
        await seedIfEmpty();
        const result = await runCrawl(true);
        return Response.json(result);
      },
      POST: async () => {
        await seedIfEmpty();
        const result = await runCrawl(true);
        return Response.json(result);
      },
    },
  },
});
