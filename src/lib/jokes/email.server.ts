import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  ensureMember,
  isEmailVerified,
  loadSettings,
  markEmailVerified,
  userEmail,
} from "./billing.server";
import { loadHouseKeys } from "./keys.server";
import { publicOrigin } from "./origin.server";

export { isEmailVerified, markEmailVerified };

const TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(userId: string) {
  await ensureMember(userId);
  const settings = await loadSettings();
  const email = ((await userEmail(userId)) ?? "").trim().toLowerCase();
  if (!email) throw new Error("This tab has no email on file.");
  if (email === settings.adminEmail.toLowerCase()) {
    await markEmailVerified(userId);
    return { sent: true, already: true, previewUrl: null as string | null };
  }
  if (await isEmailVerified(userId)) {
    return { sent: true, already: true, previewUrl: null as string | null };
  }

  const sql = await getSql();
  const recent = await sql<{ created_at: string }>`
    select created_at from email_verifications
    where user_id = ${userId}
    order by created_at desc
    limit 1
  `;
  if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 45_000) {
    throw new Error("Give that last letter a minute to land, then try again.");
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TTL_MS).toISOString();
  await sql`
    insert into email_verifications (id, user_id, email, token_hash, expires_at)
    values (${randomUUID()}, ${userId}, ${email}, ${hashToken(token)}, ${expires})
  `;
  const previewUrl = `${publicOrigin()}/verify-email?token=${token}`;
  const keys = await loadHouseKeys();
  if (!keys.resendApiKey) {
    return { sent: false, already: false, previewUrl };
  }

  const html = verificationHtml(previewUrl);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: keys.resendFromEmail,
      to: [email],
      subject: "Confirm your Laugh4.LoL tab",
      html,
      text: `Jester Bones here. Confirm this email so we know the tab is yours:\n${previewUrl}\n\nWe Could All Use A Little Laugh!`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(resendError(body) || "Resend wouldn't take the letter. Check the house keys.");
  }
  return { sent: true, already: false, previewUrl: null as string | null };
}

export async function confirmEmailToken(token: string) {
  const sql = await getSql();
  const rows = await sql<{ user_id: string; email: string; expires_at: string; used_at: string | null }>`
    select user_id, email, expires_at, used_at
    from email_verifications
    where token_hash = ${hashToken(token)}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false as const, reason: "missing" as const };
  if (row.used_at) {
    await markEmailVerified(row.user_id);
    return { ok: true as const, already: true, email: row.email };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  await sql`
    update email_verifications set used_at = now()
    where token_hash = ${hashToken(token)} and used_at is null
  `;
  await markEmailVerified(row.user_id);
  return { ok: true as const, already: false, email: row.email };
}

export async function sendAdminTestEmail() {
  const keys = await loadHouseKeys();
  if (!keys.resendApiKey) throw new Error("Paste a Resend API key first.");
  const settings = await loadSettings();
  const to = settings.adminEmail.trim();
  if (!to) throw new Error("Admin email is empty.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: keys.resendFromEmail,
      to: [to],
      subject: "Laugh4.LoL house keys — test letter",
      html: `<div style="font-family:Georgia,serif;background:#F6DE4B;padding:24px;color:#1A1408">
        <h1 style="color:#1B8A3E;font-size:28px;margin:0 0 8px">Laugh4.LoL</h1>
        <p>Resend is wired. We Could All Use A Little Laugh!</p>
      </div>`,
      text: "Resend is wired. We could all use a little laugh.",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(resendError(body) || "Resend rejected the test letter.");
  }
  return { sent: true, to };
}

function resendError(body: string) {
  try {
    const json = JSON.parse(body) as { message?: string };
    return json.message ?? "";
  } catch {
    return body.slice(0, 180);
  }
}

function verificationHtml(url: string) {
  return `<div style="font-family:Georgia,serif;background:#F6DE4B;padding:32px;color:#1A1408">
  <div style="max-width:480px;margin:0 auto;background:#FFF6C8;border:2px solid #C9A227;border-radius:20px;padding:28px">
    <p style="color:#1B8A3E;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Laugh4.LoL</p>
    <h1 style="font-size:28px;margin:0 0 12px">Confirm this tab</h1>
    <p style="margin:0 0 16px">Jester Bones here. Click the green button so we know this email is yours. We Could All Use A Little Laugh!</p>
    <p style="margin:0 0 20px"><a href="${url}" style="display:inline-block;background:#1B8A3E;color:#F6DE4B;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700">Verify my email</a></p>
    <p style="font-size:13px;color:#5C4E2A;margin:0">If the button is shy, paste this: ${url}</p>
  </div>
</div>`;
}
