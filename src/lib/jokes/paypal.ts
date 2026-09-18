import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { capturePaypalOrder, createPaypalDonation } from "./paypal.server";

export const startPaypalDonation = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ amountCents: z.number().int().min(100).max(100000) }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => createPaypalDonation(context.userId, data.amountCents));

export const finishPaypalCheckout = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ orderId: z.string().min(6).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => capturePaypalOrder(context.userId, data.orderId));
