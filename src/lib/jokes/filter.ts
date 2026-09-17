const MINOR_RE =
  /\b(child|children|kid|kids|preteen|underage|minor|minors|toddler|infant|schoolgirl|schoolboy|little boy|little girl)\b/i;

const GRAPHIC_RE =
  /\b(bestiality|snuff|csam|child porn)\b/i;

export function isUnsafeJoke(text: string, rating: "clean" | "adult") {
  if (GRAPHIC_RE.test(text)) return true;
  if (rating === "adult" && MINOR_RE.test(text)) return true;
  return false;
}

export function splitJoke(text: string): { setup: string; punchline: string; body: string } {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return { setup: "", punchline: "", body: "" };

  const qSplit = cleaned.split(/\?\s+/);
  if (qSplit.length === 2 && qSplit[0] && qSplit[1] && qSplit[0].length < 220) {
    return {
      setup: `${qSplit[0].trim()}?`,
      punchline: qSplit[1].trim(),
      body: cleaned,
    };
  }

  const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return {
      setup: lines[0] ?? "",
      punchline: lines.slice(1).join(" "),
      body: cleaned,
    };
  }

  return { setup: "", punchline: cleaned, body: cleaned };
}
