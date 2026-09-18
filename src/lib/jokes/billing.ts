import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  adminOverview,
  loadMembership,
  loadSettings,
  requireAdmin,
  savePrices,
} from "./billing.server";
import { keysStatus, loadHouseKeys, mask, writeHouseKeys } from "./keys.server";
import { sendAdminTestEmail } from "./email.server";
import { pingPaypal } from "./paypal.server";
import { jokesterUnlocked, requireJokester, unlockJokesterWithPassword } from "./jokester-lock.server";

export const getPublicPricing = createServerFn({ method: "GET" }).handler(async () => {
  const s = await loadSettings();
  return {
    tipPriceCents: s.tipPriceCents,
    roundPriceCents: s.roundPriceCents,
    dailyAi: s.dailyAi,
  };
});

export const getMembership = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadMembership(context.userId));

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => adminOverview(context.userId));

export const updateSitePrices = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        tipPriceCents: z.number().int().min(100).max(50000),
        roundPriceCents: z.number().int().min(100).max(200000),
        dailyAi: z.number().int().min(1).max(200),
        adminEmail: z.string().email().max(120),
      })
      .parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => savePrices(context.userId, data));

export const getJokesterLock = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return { unlocked: jokesterUnlocked() };
  });

export const unlockJokester = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ password: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    unlockJokesterWithPassword(data.password);
    return { unlocked: true as const };
  });

export const getHouseKeys = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    requireJokester();
    const settings = await loadSettings();
    const keys = await loadHouseKeys();
    return {
      adminEmail: settings.adminEmail,
      ...keysStatus(keys),
      resendFromEmail: keys.resendFromEmail,
      paypalWebhookIdHint: mask(keys.paypalWebhookId),
      envOverrides: {
        resend: Boolean(process.env.RESEND_API_KEY?.trim()),
        paypal: Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()),
      },
    };
  });

export const saveHouseKeys = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        resendApiKey: z.string().max(200).optional(),
        resendFromEmail: z.string().max(180).optional(),
        paypalClientId: z.string().max(200).optional(),
        paypalClientSecret: z.string().max(200).optional(),
        paypalMode: z.enum(["sandbox", "live"]).optional(),
        paypalWebhookId: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    requireJokester();
    return writeHouseKeys(data);
  });

export const testResendKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    requireJokester();
    return sendAdminTestEmail(context.userId);
  });

export const testPaypalKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    requireJokester();
    return pingPaypal(context.userId);
  });
