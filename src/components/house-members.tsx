import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMembers, saveMember } from "@/lib/jokes/members";

type Member = Awaited<ReturnType<typeof listMembers>>[number];

export function HouseMembers() {
  const [rows, setRows] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    void listMembers()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load members."));
  }, []);

  if (error && !rows) return <p className="text-sm text-adult">{error}</p>;
  if (!rows) return <div className="h-32 animate-pulse rounded-[var(--radius-xl)] bg-surface" />;

  return (
    <section className="grid gap-3">
      <header>
        <h2 className="font-display text-2xl">Members</h2>
        <p className="mt-1 text-sm text-muted">
          Names, 18+ flag, ID on file, and passwords. ID numbers stay in the house vault — not on the public Stage.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nobody has taken a tab yet.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-[var(--radius-xl)] border border-border bg-surface p-4">
              {editing === row.id ? (
                <MemberEditor
                  member={row}
                  onCancel={() => setEditing(null)}
                  onSaved={(next) => {
                    setRows((cur) => cur?.map((m) => (m.id === next.id ? next : m)) ?? [next]);
                    setEditing(null);
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{row.name || "Unnamed"}</p>
                    <p className="truncate text-sm text-muted">{row.email}</p>
                    <p className="mt-1 text-xs text-muted">
                      {row.ageVerified ? "18+ on file" : "Not age-checked"}
                      {row.idHint ? ` · ID ${row.idHint}` : " · no ID"}
                      {row.hasPassword ? " · password set" : " · no password"}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(row.id)}>
                    Edit
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberEditor({
  member,
  onCancel,
  onSaved,
}: {
  member: Member;
  onCancel: () => void;
  onSaved: (next: Member) => void;
}) {
  const [name, setName] = useState(member.name);
  const [ageVerified, setAgeVerified] = useState(member.ageVerified);
  const [idType, setIdType] = useState(member.idType === "passport" ? "passport" : member.idType === "state" ? "state" : "");
  const [idNumber, setIdNumber] = useState(member.idNumber);
  const [idJurisdiction, setIdJurisdiction] = useState(member.idJurisdiction);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await saveMember({
        data: {
          userId: member.id,
          name,
          ageVerified,
          idType: idType === "passport" || idType === "state" ? idType : "",
          idNumber,
          idJurisdiction,
          password: password.trim() || undefined,
        },
      });
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <label className="grid gap-1.5 text-sm font-medium">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-logo)]"
          checked={ageVerified}
          onChange={(e) => setAgeVerified(e.target.checked)}
        />
        Age verified (18+)
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        ID type
        <select
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-base"
          value={idType}
          onChange={(e) => setIdType(e.target.value)}
        >
          <option value="">None</option>
          <option value="state">State ID / license</option>
          <option value="passport">Passport</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        ID number
        <Input
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          autoComplete="off"
          placeholder={member.idHint || "On file"}
          maxLength={24}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        State / country
        <Input value={idJurisdiction} onChange={(e) => setIdJurisdiction(e.target.value)} maxLength={56} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        New password
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          placeholder={member.hasPassword ? "Leave blank to keep" : "Set a password"}
        />
      </label>
      {error ? <p className="text-sm text-adult">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save member"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
