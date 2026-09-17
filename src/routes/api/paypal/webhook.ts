import { createFileRoute } from "@tanstack/react-router";
import { extractPaypalOrderId, settlePaypalWebhook } from "@/lib/jokes/paypal.server";

export const Route = createFileRoute("/api/paypal/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const orderId = extractPaypalOrderId(payload);
        if (!orderId) return Response.json({ ok: true, ignored: true });
        try {
          const result = await settlePaypalWebhook(orderId);
          return Response.json(result);
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
