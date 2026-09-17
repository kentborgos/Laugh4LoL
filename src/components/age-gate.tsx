import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyGuestAge } from "@/lib/jokes/server";
import { useAge } from "@/lib/jokes/age-store";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AgeGate({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const setToken = useAge((s) => s.setToken);
  const [idType, setIdType] = useState<"state" | "passport">("state");
  const [dob, setDob] = useState("");
  const [jurisdiction, setJurisdiction] = useState("VA");
  const [idNumber, setIdNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJoke, setResultJoke] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResultJoke(null);
    try {
      const res = await verifyGuestAge({
        data: { dob, idType, jurisdiction, idNumber },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setToken(res.token, res.adult);
      setResultJoke(res.joke);
      if (!res.adult) {
        window.setTimeout(() => {
          onOpenChange(false);
          void navigate({ to: "/vault" });
        }, 2400);
      } else {
        window.setTimeout(() => onOpenChange(false), 1400);
      }
    } catch {
      setError("The velvet rope jammed. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="mb-3 flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-adult text-adult-fg">
          <ShieldAlert className="size-5" />
        </div>
        <DialogTitle>Late show check</DialogTitle>
        <DialogDescription className="mt-2">
          Dirty jokes stay behind an 18+ rope. Enter your date of birth and a State ID or Passport
          number. We check the format and your age in memory, then discard the number. It is never
          written to the joke database.
        </DialogDescription>
        <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1.5 text-sm font-medium">
            Date of birth
            <Input type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">ID type</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={idType === "state" ? "ink" : "outline"}
                onClick={() => {
                  setIdType("state");
                  setJurisdiction("VA");
                }}
              >
                State ID
              </Button>
              <Button
                type="button"
                variant={idType === "passport" ? "ink" : "outline"}
                onClick={() => {
                  setIdType("passport");
                  setJurisdiction("USA");
                }}
              >
                Passport
              </Button>
            </div>
          </fieldset>
          {idType === "state" ? (
            <label className="grid gap-1.5 text-sm font-medium">
              State
              <select
                className="h-11 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-ink"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-1.5 text-sm font-medium">
              Issuing country
              <Input
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="USA"
                required
              />
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            {idType === "state" ? "State ID / license number" : "Passport number"}
            <Input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              autoComplete="off"
              required
              minLength={5}
              maxLength={20}
              spellCheck={false}
            />
          </label>
          {error ? <p className="text-sm text-adult">{error}</p> : null}
          {resultJoke ? <p className="text-sm text-pretty text-ink">{resultJoke}</p> : null}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? "Checking the rope…" : "Verify age"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
