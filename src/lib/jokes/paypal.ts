import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { capturePaypalOrder, createPaypalCheckout } from "./paypal.server";

export const startPaypalCheckout = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ plan: z.enum(["monthly", "annual"]) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => createPaypalCheckout(context.userId, data.plan));

export const finishPaypalCheckout = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ orderId: z.string().min(6).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => capturePaypalOrder(context.userId, data.orderId));
