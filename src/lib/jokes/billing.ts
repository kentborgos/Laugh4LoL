import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { adminOverview, loadMembership, loadSettings, savePrices } from "./billing.server";
import { houseMiddleware } from "./house-middleware";
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
  .middleware([houseMiddleware])
  .handler(async ({ context }) => {
    requireJokester(context.houseToken);
    return adminOverview();
  });

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
  .middleware([houseMiddleware])
  .handler(async ({ context, data }) => {
    requireJokester(context.houseToken);
    return savePrices(data);
  });

export const getJokesterLock = createServerFn({ method: "GET" })
  .middleware([houseMiddleware])
  .handler(async ({ context }) => ({ unlocked: jokesterUnlocked(context.houseToken) }));

export const unlockJokester = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ password: z.string().min(1).max(80) }).parse(input))
  .middleware([houseMiddleware])
  .handler(async ({ data }) => unlockJokesterWithPassword(data.password));

export const getHouseKeys = createServerFn({ method: "GET" })
  .middleware([houseMiddleware])
  .handler(async ({ context }) => {
    requireJokester(context.houseToken);
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
  .middleware([houseMiddleware])
  .handler(async ({ context, data }) => {
    requireJokester(context.houseToken);
    return writeHouseKeys(data);
  });

export const testResendKey = createServerFn({ method: "POST" })
  .middleware([houseMiddleware])
  .handler(async ({ context }) => {
    requireJokester(context.houseToken);
    return sendAdminTestEmail();
  });

export const testPaypalKey = createServerFn({ method: "POST" })
  .middleware([houseMiddleware])
  .handler(async ({ context }) => {
    requireJokester(context.houseToken);
    return pingPaypal();
  });
