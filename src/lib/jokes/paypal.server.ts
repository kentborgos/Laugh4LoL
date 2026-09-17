import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { ensureMember, isEmailVerified, loadMembership, loadSettings, requireAdmin, startPlan } from "./billing.server";
import { loadHouseKeys } from "./keys.server";
import { dollars } from "./money";
import { publicOrigin } from "./origin.server";

type PaypalMode = "sandbox" | "live";

function apiHost(mode: PaypalMode) {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

type TokenCache = { token: string; exp: number; fingerprint: string };
const globalRef = globalThis as typeof globalThis & { __laughPaypalToken__?: TokenCache };

async function paypalToken() {
  const keys = await loadHouseKeys();
  if (!keys.paypalClientId || !keys.paypalClientSecret) {
    throw new Error("PayPal house keys aren't set. Admin pastes them at /jokester.");
  }
  const fingerprint = `${keys.paypalMode}:${keys.paypalClientId}`;
  const cached = globalRef.__laughPaypalToken__;
  if (cached && cached.fingerprint === fingerprint && cached.exp > Date.now() + 15_000) {
    return { token: cached.token, keys };
  }
  const basic = Buffer.from(`${keys.paypalClientId}:${keys.paypalClientSecret}`).toString("base64");
  const res = await fetch(`${apiHost(keys.paypalMode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || "PayPal wouldn't issue a token. Check the client id and secret.");
  }
  globalRef.__laughPaypalToken__ = {
    token: json.access_token,
    exp: Date.now() + Math.max(30, (json.expires_in ?? 300) - 30) * 1000,
    fingerprint,
  };
  return { token: json.access_token, keys };
}

async function paypalFetch(path: string, init: RequestInit = {}) {
  const { token, keys } = await paypalToken();
  const res = await fetch(`${apiHost(keys.paypalMode)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error_description === "string" && json.error_description) ||
      "PayPal request failed.";
    throw new Error(msg);
  }
  return json;
}

export async function pingPaypal(userId: string) {
  await requireAdmin(userId);
  const { keys } = await paypalToken();
  return { ok: true as const, mode: keys.paypalMode };
}

export async function createPaypalCheckout(userId: string, plan: "monthly" | "annual") {
  await ensureMember(userId);
  if (!(await isEmailVerified(userId))) {
    throw new Error("Confirm your email before PayPal will take a seat.");
  }
  const membership = await loadMembership(userId);
  const settings = await loadSettings();
  const price = plan === "monthly" ? settings.monthlyPriceCents : settings.annualPriceCents;
  const origin = publicOrigin();
  const order = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `${plan}:${userId}`.slice(0, 127),
          custom_id: userId.slice(0, 127),
          description: `Laugh4.LoL ${plan} membership`,
          amount: { currency_code: "USD", value: dollars(price) },
        },
      ],
      application_context: {
        brand_name: "Laugh4.LoL",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${origin}/account?paypal=return`,
        cancel_url: `${origin}/account?paypal=cancel`,
      },
    }),
  });
  const orderId = String(order.id ?? "");
  const links = Array.isArray(order.links) ? (order.links as Array<{ href?: string; rel?: string }>) : [];
  const approve = links.find((l) => l.rel === "approve")?.href;
  if (!orderId || !approve) throw new Error("PayPal didn't hand back a checkout link.");
  const sql = await getSql();
  await sql`
    insert into payments (id, user_id, plan, amount_cents, paypal_order_id, status)
    values (${randomUUID()}, ${userId}, ${plan}, ${price}, ${orderId}, ${"created"})
    on conflict (paypal_order_id) do nothing
  `;
  return { url: approve, orderId, plan, amountCents: price, membership };
}

type CaptureResult = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    payments?: { captures?: Array<{ status?: string }> };
  }>;
  payer?: { email_address?: string };
};

export async function capturePaypalOrder(userId: string, orderId: string) {
  await ensureMember(userId);
  const sql = await getSql();
  const existing = await sql<{
    user_id: string;
    plan: "monthly" | "annual";
    status: string;
  }>`select user_id, plan, status from payments where paypal_order_id = ${orderId}`;
  const row = existing[0];
  if (!row || row.user_id !== userId) throw new Error("That PayPal tab isn't on this account.");
  if (row.status === "completed") return loadMembership(userId);

  let captured: CaptureResult;
  try {
    captured = (await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      body: "{}",
    })) as CaptureResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!/ALREADY_CAPTURED|already captured/i.test(msg)) throw err;
    captured = (await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`)) as CaptureResult;
  }

  return settleCapture(userId, orderId, row.plan, captured);
}

export async function settlePaypalWebhook(orderId: string) {
  const sql = await getSql();
  const existing = await sql<{
    user_id: string;
    plan: "monthly" | "annual";
    status: string;
  }>`select user_id, plan, status from payments where paypal_order_id = ${orderId}`;
  const row = existing[0];
  if (!row) return { ok: false as const };
  if (row.status === "completed") return { ok: true as const };
  const order = (await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`)) as CaptureResult;
  if (order.status !== "COMPLETED") return { ok: false as const };
  await settleCapture(row.user_id, orderId, row.plan, order);
  return { ok: true as const };
}

async function settleCapture(
  userId: string,
  orderId: string,
  plan: "monthly" | "annual",
  captured: CaptureResult,
) {
  const customId = captured.purchase_units?.[0]?.custom_id;
  if (customId && customId !== userId) throw new Error("PayPal order belongs to a different tab.");
  const captureOk =
    captured.status === "COMPLETED" ||
    captured.purchase_units?.[0]?.payments?.captures?.some((c) => c.status === "COMPLETED");
  if (!captureOk) throw new Error("PayPal hasn't captured that order yet.");
  const payer = captured.payer?.email_address ?? "";
  const sql = await getSql();
  await sql`
    update payments
    set status = ${"completed"}, payer_email = ${payer}, captured_at = now()
    where paypal_order_id = ${orderId}
  `;
  await startPlan(userId, plan);
  await sql`
    update subscriptions
    set paypal_order_id = ${orderId}, payer_email = ${payer}
    where user_id = ${userId}
  `;
  return loadMembership(userId);
}

export function extractPaypalOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  const resource = body.resource && typeof body.resource === "object" ? (body.resource as Record<string, unknown>) : {};
  const event = typeof body.event_type === "string" ? body.event_type : "";
  if (event.startsWith("CHECKOUT.ORDER") && typeof resource.id === "string") return resource.id;
  const supplementary = resource.supplementary_data;
  if (supplementary && typeof supplementary === "object") {
    const related = (supplementary as Record<string, unknown>).related_ids;
    if (related && typeof related === "object") {
      const orderId = (related as Record<string, unknown>).order_id;
      if (typeof orderId === "string" && orderId.length > 6) return orderId;
    }
  }
  if (typeof resource.id === "string" && resource.id.startsWith("ORDER-")) return resource.id;
  return null;
}
