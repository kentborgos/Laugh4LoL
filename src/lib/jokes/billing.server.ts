import { getSql } from "@/lib/db";
import { dollars } from "./money";

export { dollars };

export type Plan = "free" | "monthly" | "annual";

export type Settings = {
  monthlyPriceCents: number;
  annualPriceCents: number;
  adminEmail: string;
  freeDailyAi: number;
  paidDailyAi: number;
};

export type Membership = {
  plan: Plan;
  paid: boolean;
  status: string;
  expiresAt: string | null;
  remainingToday: number;
  dailyLimit: number;
  isAdmin: boolean;
  monthlyPriceCents: number;
  annualPriceCents: number;
  adminEmail: string;
  usedToday: number;
};

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
    monthlyPriceCents: row?.monthly_price_cents ?? 599,
    annualPriceCents: row?.annual_price_cents ?? 4999,
    adminEmail: row?.admin_email ?? "kent.borgos22@gmail.com",
    freeDailyAi: row?.free_daily_ai ?? 5,
    paidDailyAi: row?.paid_daily_ai ?? 80,
  };
}

export async function userEmail(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId}
  `;
  return rows[0]?.email ?? null;
}

export async function ensureMember(userId: string): Promise<{ role: "member" | "admin"; email: string }> {
  const sql = await getSql();
  const settings = await loadSettings();
  const email = (await userEmail(userId)) ?? "";
  const emailMatch = email.toLowerCase() === settings.adminEmail.toLowerCase();
  const existing = await sql<{ role: "member" | "admin"; email: string }>`
    select role, email from profiles where user_id = ${userId}
  `;
  if (existing[0]) {
    if (email && existing[0].email !== email) {
      await sql`update profiles set email = ${email} where user_id = ${userId}`;
    }
    if (emailMatch && existing[0].role !== "admin") {
      await sql`update profiles set role = ${"admin"} where user_id = ${userId}`;
      return { role: "admin", email: email || existing[0].email };
    }
    return { role: existing[0].role, email: email || existing[0].email };
  }

  const adminCount = await sql<{ n: number }>`
    select count(*)::int as n from profiles where role = ${"admin"}
  `;
  // Bootstrap: first house account, or the configured admin email, runs backstage.
  const role: "member" | "admin" = emailMatch || (adminCount[0]?.n ?? 0) === 0 ? "admin" : "member";

  await sql`
    insert into profiles (user_id, email, role)
    values (${userId}, ${email}, ${role})
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into subscriptions (user_id, plan, status, price_cents)
    values (${userId}, ${"free"}, ${"active"}, 0)
    on conflict (user_id) do nothing
  `;
  return { role, email };
}

function paidActive(plan: Plan, status: string, expiresAt: string | null) {
  if (status !== "active") return false;
  if (plan !== "monthly" && plan !== "annual") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function loadMembership(userId: string): Promise<Membership> {
  const sql = await getSql();
  const profile = await ensureMember(userId);
  const settings = await loadSettings();
  const sub = await sql<{
    plan: Plan;
    status: string;
    expires_at: string | null;
  }>`select plan, status, expires_at from subscriptions where user_id = ${userId}`;
  const plan = sub[0]?.plan ?? "free";
  const status = sub[0]?.status ?? "active";
  const expiresAt = sub[0]?.expires_at ?? null;
  const paid = paidActive(plan, status, expiresAt);
  const dailyLimit = paid ? settings.paidDailyAi : settings.freeDailyAi;
  const used = await sql<{ count: number }>`
    select count from ai_usage where user_id = ${userId} and day = ${todayUtc()}::date
  `;
  const usedToday = used[0]?.count ?? 0;
  return {
    plan: paid ? plan : "free",
    paid,
    status,
    expiresAt,
    remainingToday: Math.max(0, dailyLimit - usedToday),
    dailyLimit,
    isAdmin: profile.role === "admin",
    monthlyPriceCents: settings.monthlyPriceCents,
    annualPriceCents: settings.annualPriceCents,
    adminEmail: settings.adminEmail,
    usedToday,
  };
}

export async function consumeAiQuota(userId: string) {
  const sql = await getSql();
  const membership = await loadMembership(userId);
  if (membership.remainingToday <= 0) {
    return { allowed: false as const, membership };
  }
  await sql`
    insert into ai_usage (user_id, day, count)
    values (${userId}, ${todayUtc()}::date, 1)
    on conflict (user_id, day) do update set count = ai_usage.count + 1
  `;
  return {
    allowed: true as const,
    membership: {
      ...membership,
      usedToday: membership.usedToday + 1,
      remainingToday: membership.remainingToday - 1,
    },
  };
}

export async function startPlan(userId: string, plan: "monthly" | "annual") {
  const sql = await getSql();
  await ensureMember(userId);
  const settings = await loadSettings();
  const price = plan === "monthly" ? settings.monthlyPriceCents : settings.annualPriceCents;
  const days = plan === "monthly" ? 30 : 365;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await sql`
    insert into subscriptions (user_id, plan, status, price_cents, started_at, expires_at)
    values (${userId}, ${plan}, ${"active"}, ${price}, now(), ${expires})
    on conflict (user_id) do update set
      plan = ${plan},
      status = ${"active"},
      price_cents = ${price},
      started_at = now(),
      expires_at = ${expires}
  `;
  return loadMembership(userId);
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
    monthlyPriceCents: number;
    annualPriceCents: number;
    freeDailyAi: number;
    paidDailyAi: number;
    adminEmail: string;
  },
) {
  await requireAdmin(userId);
  const sql = await getSql();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  await sql`
    update site_settings
    set monthly_price_cents = ${input.monthlyPriceCents},
        annual_price_cents = ${input.annualPriceCents},
        free_daily_ai = ${input.freeDailyAi},
        paid_daily_ai = ${input.paidDailyAi},
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
  const counts = await sql<{
    members: number;
    paid: number;
    chats_today: number;
  }>`
    select
      (select count(*)::int from profiles) as members,
      (select count(*)::int from subscriptions where plan in ('monthly','annual') and status = 'active') as paid,
      (select coalesce(sum(count), 0)::int from ai_usage where day = ${todayUtc()}::date) as chats_today
  `;
  return {
    settings,
    members: counts[0]?.members ?? 0,
    paid: counts[0]?.paid ?? 0,
    chatsToday: counts[0]?.chats_today ?? 0,
  };
}
