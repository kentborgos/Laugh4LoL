import { createFileRoute } from "@tanstack/react-router";
import { confirmEmailToken } from "@/lib/jokes/email.server";

export const Route = createFileRoute("/api/resend/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let token = "";
        try {
          const body = (await request.json()) as { token?: unknown };
          token = typeof body.token === "string" ? body.token.trim() : "";
        } catch {
          token = "";
        }
        if (token.length < 16 || token.length > 128) {
          return Response.json({ ok: false, error: "Missing confirm token." }, { status: 400 });
        }
        const result = await confirmEmailToken(token);
        if (!result.ok) {
          return Response.json(
            { ok: false, reason: result.reason },
            { status: result.reason === "expired" ? 410 : 404 },
          );
        }
        return Response.json({ ok: true, already: result.already, email: result.email });
      },
    },
  },
});
