import { createFileRoute } from "@tanstack/react-router";
import { keysStatus, loadHouseKeys } from "@/lib/jokes/keys.server";

export const Route = createFileRoute("/api/resend/")({
  server: {
    handlers: {
      GET: async () => {
        const keys = keysStatus(await loadHouseKeys());
        return Response.json({
          ok: true,
          provider: "resend",
          ready: keys.resendReady,
          from: keys.resendFromEmail,
        });
      },
    },
  },
});
