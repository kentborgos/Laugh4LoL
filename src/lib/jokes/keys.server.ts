import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "@/lib/db";

export type HouseKeys = {
  resendApiKey: string;
  resendFromEmail: string;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalMode: "sandbox" | "live";
  paypalWebhookId: string;
};

const LOCAL_KEYS_PATH = join(process.cwd(), "data", "house-keys.local.json");

function first(...vals: Array<string | undefined | null>) {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

function modeOf(value: string | undefined): "sandbox" | "live" {
  return value?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

function onVercel() {
  return Boolean(process.env.VERCEL);
}

function readLocalKeys(): Partial<HouseKeys> {
  if (onVercel()) return {};
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_KEYS_PATH, "utf8")) as Record<string, unknown>;
    return {
      resendApiKey: typeof parsed.resendApiKey === "string" ? parsed.resendApiKey : "",
      resendFromEmail: typeof parsed.resendFromEmail === "string" ? parsed.resendFromEmail : "",
      paypalClientId: typeof parsed.paypalClientId === "string" ? parsed.paypalClientId : "",
      paypalClientSecret: typeof parsed.paypalClientSecret === "string" ? parsed.paypalClientSecret : "",
      paypalMode: parsed.paypalMode === "live" ? "live" : parsed.paypalMode === "sandbox" ? "sandbox" : undefined,
      paypalWebhookId: typeof parsed.paypalWebhookId === "string" ? parsed.paypalWebhookId : "",
    };
  } catch {
    return {};
  }
}

function writeLocalKeys(keys: HouseKeys) {
  if (onVercel()) return;
  try {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(LOCAL_KEYS_PATH, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 });
  } catch {
    /* preview disk may be read-only — DB still holds the values */
  }
}

export async function loadHouseKeys(): Promise<HouseKeys> {
  const sql = await getSql();
  await sql`insert into site_settings (id) values (1) on conflict (id) do nothing`;
  const rows = await sql<{
    resend_api_key: string;
    resend_from_email: string;
    paypal_client_id: string;
    paypal_client_secret: string;
    paypal_mode: string;
    paypal_webhook_id: string;
  }>`
    select resend_api_key, resend_from_email, paypal_client_id, paypal_client_secret, paypal_mode, paypal_webhook_id
    from site_settings where id = 1
  `;
  const row = rows[0];
  const local = readLocalKeys();
  return {
    resendApiKey: first(process.env.RESEND_API_KEY, local.resendApiKey, row?.resend_api_key),
    resendFromEmail: first(
      process.env.RESEND_FROM_EMAIL,
      local.resendFromEmail,
      row?.resend_from_email,
      "Laugh4.LoL <onboarding@resend.dev>",
    ),
    paypalClientId: first(process.env.PAYPAL_CLIENT_ID, local.paypalClientId, row?.paypal_client_id),
    paypalClientSecret: first(process.env.PAYPAL_CLIENT_SECRET, local.paypalClientSecret, row?.paypal_client_secret),
    paypalMode: modeOf(first(process.env.PAYPAL_MODE, local.paypalMode, row?.paypal_mode)),
    paypalWebhookId: first(process.env.PAYPAL_WEBHOOK_ID, local.paypalWebhookId, row?.paypal_webhook_id),
  };
}

export function keysStatus(keys: HouseKeys) {
  return {
    resendReady: Boolean(keys.resendApiKey),
    paypalReady: Boolean(keys.paypalClientId && keys.paypalClientSecret),
    paypalMode: keys.paypalMode,
    resendFromEmail: keys.resendFromEmail,
    paypalClientIdHint: mask(keys.paypalClientId),
    resendApiKeyHint: mask(keys.resendApiKey),
  };
}

export function mask(value: string) {
  const t = value.trim();
  if (!t) return "";
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 3)}••••${t.slice(-4)}`;
}

export async function writeHouseKeys(input: {
  resendApiKey?: string;
  resendFromEmail?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalMode?: "sandbox" | "live";
  paypalWebhookId?: string;
}) {
  const current = await loadHouseKeys();
  const sql = await getSql();
  const resendApiKey = keepOr(input.resendApiKey, current.resendApiKey);
  const resendFromEmail = keepOr(input.resendFromEmail, current.resendFromEmail) || "Laugh4.LoL <onboarding@resend.dev>";
  const paypalClientId = keepOr(input.paypalClientId, current.paypalClientId);
  const paypalClientSecret = keepOr(input.paypalClientSecret, current.paypalClientSecret);
  const paypalMode = input.paypalMode ?? current.paypalMode;
  const paypalWebhookId = keepOr(input.paypalWebhookId, current.paypalWebhookId);
  await sql`
    update site_settings
    set resend_api_key = ${resendApiKey},
        resend_from_email = ${resendFromEmail},
        paypal_client_id = ${paypalClientId},
        paypal_client_secret = ${paypalClientSecret},
        paypal_mode = ${paypalMode},
        paypal_webhook_id = ${paypalWebhookId},
        updated_at = now()
    where id = 1
  `;
  const next = await loadHouseKeys();
  writeLocalKeys(next);
  return keysStatus(next);
}

function keepOr(next: string | undefined, current: string) {
  if (next == null) return current;
  const t = next.trim();
  if (!t || t.includes("••••")) return current;
  return t;
}
