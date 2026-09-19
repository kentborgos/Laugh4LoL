import { getSql } from "@/lib/db";
import { keysStatus, loadHouseKeys } from "./keys.server";
import { dollars } from "./money";

export { dollars };

export type Plan = "free";

export type Settings = {
  tipPriceCents: number;
  roundPriceCents: number;
  adminEmail: string;
  dailyAi: number;
};

export type Membership = {
  plan: Plan;
  paid: boolean;
  status: string;
  expiresAt: string | null;
  remainingToday: number;
  dailyLimit: number;
  isAdmin: boolean;
  tipPriceCents: number;
  roundPriceCents: number;
  adminEmail: string;
  usedToday: number;
  email: string;
  emailVerified: boolean;
  paypalReady: boolean;
  resendReady: boolean;
  paypalMode: "sandbox" | "live";
};

const HOUSE_ADMIN_EMAILS = ["kent.borgos22@gmail.com"];

function isHouseAdminEmail(email: string, settingsEmail: string) {
  const got = email.trim().toLowerCase();
  if (!got) return false;
  if (HOUSE_ADMIN_EMAILS.includes(got)) return true;
  const listed = settingsEmail.trim().toLowerCase();
  return Boolean(listed) && got === listed;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadSettings(): Promise<Settings> {
  const sql = await getSql();
  await sql`insert into site_settings (id) values (1) on conflict (id) do nothing`;
  const rows = await sql<{
    monthly_price_cents: number;
    annual_price_cents: number;
    admin_email: string;
    free_daily_ai: number;
    paid_daily_ai: number;
  }>`
    select monthly_price_cents, annual_price_cents, admin_email, free_daily_ai, paid_daily_ai
    from site_settings where id = 1
  `;
  const row = rows[0];
  return {
    tipPriceCents: row?.monthly_price_cents ?? 500,
    roundPriceCents: row?.annual_price_cents ?? 2500,
    adminEmail: row?.admin_email ?? "kent.borgos22@gmail.com",
    dailyAi: row?.paid_daily_ai ?? row?.free_daily_ai ?? 80,
  };
}

export async function userEmail(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId}
  `;
  return rows[0]?.email ?? null;
}

export async function markEmailVerified(userId: string) {
  const sql = await getSql();
  await sql`update profiles set email_verified = true where user_id = ${userId}`;
  await sql`update "user" set "emailVerified" = true, "updatedAt" = now() where id = ${userId}`;
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const sql = await getSql();
  const profile = await sql<{ email_verified: boolean }>`
    select email_verified from profiles where user_id = ${userId}
  `;
  if (profile[0]?.email_verified) return true;
  const user = await sql<{ emailVerified: boolean }>`
    select "emailVerified" as "emailVerified" from "user" where id = ${userId}
  `;
  if (user[0]?.emailVerified) {
    await markEmailVerified(userId);
    return true;
  }
  return false;
}

export async function ensureMember(userId: string): Promise<{ role: "member" | "admin"; email: string }> {
  const sql = await getSql();
  const settings = await loadSettings();
  const email = (await userEmail(userId)) ?? "";
  const emailMatch = isHouseAdminEmail(email, settings.adminEmail);
  const existing = await sql<{ role: "member" | "admin"; email: string }>`
    select role, email from profiles where user_id = ${userId}
  `;
  if (existing[0]) {
    if (email && existing[0].email !== email) {
      await sql`update profiles set email = ${email} where user_id = ${userId}`;
    }
    if (emailMatch && existing[0].role !== "admin") {
      await sql`update profiles set role = ${"admin"} where user_id = ${userId}`;
      await markEmailVerified(userId);
      return { role: "admin", email: email || existing[0].email };
    }
    return { role: existing[0].role, email: email || existing[0].email };
  }

  const adminCount = await sql<{ n: number }>`
    select count(*)::int as n from profiles where role = ${"admin"}
  `;
  const role: "member" | "admin" = emailMatch || (adminCount[0]?.n ?? 0) === 0 ? "admin" : "member";

  await sql`
    insert into profiles (user_id, email, role, email_verified)
    values (${userId}, ${email}, ${role}, ${role === "admin"})
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into subscriptions (user_id, plan, status, price_cents)
    values (${userId}, ${"free"}, ${"active"}, 0)
    on conflict (user_id) do nothing
  `;
  if (role === "admin") await markEmailVerified(userId);
  return { role, email };
}

export async function loadMembership(userId: string): Promise<Membership> {
  const sql = await getSql();
  const profile = await ensureMember(userId);
  const settings = await loadSettings();
  const keys = keysStatus(await loadHouseKeys());
  const used = await sql<{ count: number }>`
    select count from ai_usage where user_id = ${userId} and day = ${todayUtc()}::date
  `;
  const usedToday = used[0]?.count ?? 0;
  const emailVerified = profile.role === "admin" ? true : await isEmailVerified(userId);
  return {
    plan: "free",
    paid: false,
    status: "active",
    expiresAt: null,
    remainingToday: Math.max(0, settings.dailyAi - usedToday),
    dailyLimit: settings.dailyAi,
    isAdmin: profile.role === "admin",
    tipPriceCents: settings.tipPriceCents,
    roundPriceCents: settings.roundPriceCents,
    adminEmail: settings.adminEmail,
    usedToday,
    email: profile.email,
    emailVerified,
    paypalReady: keys.paypalReady,
    resendReady: keys.resendReady,
    paypalMode: keys.paypalMode,
  };
}

export async function consumeAiQuota(userId: string) {
  const sql = await getSql();
  const membership = await loadMembership(userId);
  if (!membership.emailVerified) {
    return { allowed: false as const, reason: "unverified" as const, membership };
  }
  if (membership.remainingToday <= 0) {
    return { allowed: false as const, reason: "limit" as const, membership };
  }
  await sql`
    insert into ai_usage (user_id, day, count)
    values (${userId}, ${todayUtc()}::date, 1)
    on conflict (user_id, day) do update set count = ai_usage.count + 1
  `;
  return {
    allowed: true as const,
    reason: "ok" as const,
    membership: {
      ...membership,
      usedToday: membership.usedToday + 1,
      remainingToday: membership.remainingToday - 1,
    },
  };
}

export async function requireAdmin(userId: string) {
  const member = await ensureMember(userId);
  if (member.role !== "admin") {
    throw new Error("Admin only");
  }
  return member;
}

export async function savePrices(
  userId: string,
  input: {
    tipPriceCents: number;
    roundPriceCents: number;
    dailyAi: number;
    adminEmail: string;
  },
) {
  await requireAdmin(userId);
  const sql = await getSql();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  await sql`
    update site_settings
    set monthly_price_cents = ${input.tipPriceCents},
        annual_price_cents = ${input.roundPriceCents},
        free_daily_ai = ${input.dailyAi},
        paid_daily_ai = ${input.dailyAi},
        admin_email = ${adminEmail},
        updated_at = now()
    where id = 1
  `;
  await sql`
    update profiles set role = ${"admin"}
    where lower(email) = ${adminEmail} and email <> ''
  `;
  return loadSettings();
}

export async function adminOverview(userId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const settings = await loadSettings();
  const keys = keysStatus(await loadHouseKeys());
  let members = 0;
  let donations = 0;
  let chatsToday = 0;
  try {
    const counts = await sql<{ members: number; donations: number; chats_today: number }>`
      select
        (select count(*)::int from profiles) as members,
        (select count(*)::int from payments where status = 'completed') as donations,
        (select coalesce(sum(count), 0)::int from ai_usage where day = ${todayUtc()}::date) as chats_today
    `;
    members = counts[0]?.members ?? 0;
    donations = counts[0]?.donations ?? 0;
    chatsToday = counts[0]?.chats_today ?? 0;
  } catch {
    const fallback = await sql<{ members: number; chats_today: number }>`
      select
        (select count(*)::int from profiles) as members,
        (select coalesce(sum(count), 0)::int from ai_usage where day = ${todayUtc()}::date) as chats_today
    `;
    members = fallback[0]?.members ?? 0;
    chatsToday = fallback[0]?.chats_today ?? 0;
  }
  return {
    settings,
    members,
    donations,
    chatsToday,
    resendReady: keys.resendReady,
    paypalReady: keys.paypalReady,
  };
}
