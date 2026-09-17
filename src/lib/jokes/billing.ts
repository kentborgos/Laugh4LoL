import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  adminOverview,
  loadMembership,
  loadSettings,
  savePrices,
  startPlan,
} from "./billing.server";

export const getPublicPricing = createServerFn({ method: "GET" }).handler(async () => {
  const s = await loadSettings();
  return {
    monthlyPriceCents: s.monthlyPriceCents,
    annualPriceCents: s.annualPriceCents,
    freeDailyAi: s.freeDailyAi,
    paidDailyAi: s.paidDailyAi,
  };
});

export const getMembership = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadMembership(context.userId));

export const subscribePlan = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ plan: z.enum(["monthly", "annual"]) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => startPlan(context.userId, data.plan));

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => adminOverview(context.userId));

export const updateSitePrices = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        monthlyPriceCents: z.number().int().min(100).max(50000),
        annualPriceCents: z.number().int().min(100).max(200000),
        freeDailyAi: z.number().int().min(1).max(20),
        paidDailyAi: z.number().int().min(10).max(200),
        adminEmail: z.string().email().max(120),
      })
      .parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => savePrices(context.userId, data));
