import { createFileRoute } from "@tanstack/react-router";
import { UnauthorizedError, requireUserId } from "@/lib/auth/verify.server";
import { sendVerificationEmail } from "@/lib/jokes/email.server";

export const Route = createFileRoute("/api/resend/send")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const userId = await requireUserId();
          const result = await sendVerificationEmail(userId);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
          }
          const message = err instanceof Error ? err.message : "Resend wouldn't take the letter.";
          const status = /minute to land/i.test(message) ? 429 : 400;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
