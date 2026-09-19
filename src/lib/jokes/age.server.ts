import { signAgeToken } from "./age-token";
import { getSql } from "@/lib/db";

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

export type AgeInput = {
  dob: string;
  idType: "state" | "passport";
  jurisdiction: string;
  idNumber: string;
};

function ageFromDob(dob: string, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) {
    return null;
  }
  if (birth.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - year;
  const hadBirthday =
    now.getUTCMonth() > month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

function looksFake(id: string) {
  if (/^(.)\1+$/.test(id)) return true;
  if (/^123456/.test(id) || /^000/.test(id) || /^abc/i.test(id)) return true;
  return false;
}

function validateId(input: AgeInput) {
  const id = input.idNumber.replace(/\s+/g, "").toUpperCase();
  if (looksFake(id)) return "That ID number does not look real enough to get you past the velvet rope.";
  if (input.idType === "passport") {
    if (!/^[A-Z0-9]{6,9}$/.test(id)) {
      return "Passport numbers are 6–9 letters or digits. Check the number and try again.";
    }
    if (input.jurisdiction.trim().length < 2) return "Tell us which country issued the passport.";
    return null;
  }
  const state = input.jurisdiction.trim().toUpperCase();
  if (!US_STATES.has(state)) return "Pick a US state for a State ID or driver's license.";
  if (!/^[A-Z0-9-]{5,20}$/.test(id)) {
    return "State ID / license numbers are 5–20 letters or digits.";
  }
  return null;
}

const UNDERAGE_BITS = [
  "I'd let you in the late show, but your ID photo still has a juice-box. Clean room's that way — the jokes there don't need a fake mustache.",
  "Security says your punchlines still have a curfew. Come back when the candles cost more than the cake.",
  "You're so young the cigar in my teeth is older than your dating life. Stick to the clean set. We could all use a little laugh that won't get me fired.",
  "Nice try, kid. I ran your age and the only thing that's 18 is the number of dad jokes I'm about to hit you with.",
];

export async function verifyAge(input: AgeInput) {
  const age = ageFromDob(input.dob);
  if (age == null) {
    return { ok: false as const, error: "That date of birth does not compute. Use YYYY-MM-DD." };
  }
  const idError = validateId(input);
  if (idError) return { ok: false as const, error: idError };

  // ID is format-checked in memory. Signed-in members may keep it on their
  // profile so house backstage can edit the 18+ file. Guests: discarded.
  if (age < 18) {
    const sql = await getSql();
    const joke = await sql<{ setup: string; punchline: string }>`
      select setup, punchline from jokes where rating = ${"clean"} order by random() limit 1
    `;
    const bit = UNDERAGE_BITS[age % UNDERAGE_BITS.length] ?? UNDERAGE_BITS[0];
    const vault = joke[0] ? ` ${joke[0].setup} ${joke[0].punchline}` : "";
    return {
      ok: true as const,
      adult: false,
      age,
      token: signAgeToken(false),
      redirect: "/vault",
      joke: `${bit}${vault}`.trim(),
    };
  }

  return {
    ok: true as const,
    adult: true,
    age,
    token: signAgeToken(true),
    redirect: "/",
    joke: "Welcome to the late show. The cigar is lit. Don't make me regret the velvet rope.",
  };
}
