import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

export type HouseMember = {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin";
  emailVerified: boolean;
  ageVerified: boolean;
  idType: string;
  idNumber: string;
  idJurisdiction: string;
  hasPassword: boolean;
  createdAt: string;
};

function maskId(value: string) {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 4) return "••••";
  return `${"•".repeat(Math.max(2, v.length - 4))}${v.slice(-4)}`;
}

export async function listHouseMembers(): Promise<HouseMember[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    created_at: string;
    role: "member" | "admin" | null;
    age_verified: boolean | null;
    id_type: string | null;
    id_number: string | null;
    id_jurisdiction: string | null;
    has_password: boolean;
  }>`
    select
      u.id,
      u.name,
      u.email,
      u."emailVerified" as email_verified,
      u."createdAt"::text as created_at,
      p.role,
      p.age_verified,
      p.id_type,
      p.id_number,
      p.id_jurisdiction,
      exists (
        select 1 from account a
        where a."userId" = u.id and a."providerId" = 'credential' and a.password is not null and a.password <> ''
      ) as has_password
    from "user" u
    left join profiles p on p.user_id = u.id
    order by u."createdAt" desc
    limit 500
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "admin" ? "admin" : "member",
    emailVerified: Boolean(row.email_verified),
    ageVerified: Boolean(row.age_verified),
    idType: row.id_type ?? "",
    idNumber: row.id_number ?? "",
    idJurisdiction: row.id_jurisdiction ?? "",
    hasPassword: Boolean(row.has_password),
    createdAt: row.created_at,
  }));
}

export async function saveMemberAge(
  userId: string,
  input: { adult: boolean; idType: string; idNumber: string; jurisdiction: string },
) {
  const sql = await getSql();
  const idNumber = input.idNumber.replace(/\s+/g, "").toUpperCase().slice(0, 24);
  await sql`
    insert into profiles (user_id, age_verified, id_type, id_number, id_jurisdiction)
    values (${userId}, ${input.adult}, ${input.idType}, ${idNumber}, ${input.jurisdiction.trim().slice(0, 56)})
    on conflict (user_id) do update set
      age_verified = excluded.age_verified,
      id_type = excluded.id_type,
      id_number = excluded.id_number,
      id_jurisdiction = excluded.id_jurisdiction
  `;
}

export async function updateHouseMember(input: {
  userId: string;
  name: string;
  ageVerified: boolean;
  idType: string;
  idNumber: string;
  idJurisdiction: string;
  password?: string;
}): Promise<HouseMember> {
  const sql = await getSql();
  const existing = await sql<{ id: string; email: string }>`
    select id, email from "user" where id = ${input.userId} limit 1
  `;
  const user = existing[0];
  if (!user) throw new Error("No member with that id.");

  const name = input.name.trim().slice(0, 80) || "Guest";
  await sql`
    update "user" set name = ${name}, "updatedAt" = now() where id = ${input.userId}
  `;

  const idType = input.idType === "passport" ? "passport" : input.idType === "state" ? "state" : "";
  const idNumber = input.idNumber.replace(/\s+/g, "").toUpperCase().slice(0, 24);
  const jurisdiction = input.idJurisdiction.trim().slice(0, 56);
  await sql`
    insert into profiles (user_id, email, age_verified, id_type, id_number, id_jurisdiction)
    values (${input.userId}, ${user.email}, ${input.ageVerified}, ${idType}, ${idNumber}, ${jurisdiction})
    on conflict (user_id) do update set
      email = excluded.email,
      age_verified = excluded.age_verified,
      id_type = excluded.id_type,
      id_number = excluded.id_number,
      id_jurisdiction = excluded.id_jurisdiction
  `;

  const nextPassword = input.password?.trim() ?? "";
  if (nextPassword) {
    if (nextPassword.length < 8) throw new Error("Passwords need at least 8 characters.");
    const hashed = await hashPassword(nextPassword);
    const cred = await sql<{ id: string }>`
      select id from account where "userId" = ${input.userId} and "providerId" = 'credential' limit 1
    `;
    if (cred[0]) {
      await sql`
        update account set password = ${hashed}, "updatedAt" = now() where id = ${cred[0].id}
      `;
    } else {
      await sql`
        insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${randomUUID()}, ${user.email}, ${"credential"}, ${input.userId}, ${hashed}, now(), now())
      `;
    }
  }

  const members = await listHouseMembers();
  const updated = members.find((m) => m.id === input.userId);
  if (!updated) throw new Error("Saved, but the member list didn't refresh.");
  return updated;
}

export function memberHint(member: HouseMember) {
  return {
    ...member,
    idHint: maskId(member.idNumber),
  };
}
