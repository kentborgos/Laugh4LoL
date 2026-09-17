#!/usr/bin/env python3
"""Build a compact, deduped joke catalog from the open datasets in /tmp/joke-raw."""

from __future__ import annotations

import csv
import hashlib
import html
import json
import re
from pathlib import Path

RAW = Path("/tmp/joke-raw")
OUT = Path("/workspace/src/lib/jokes/catalog")
PART_SIZE = 2500
REDDIT_MIN_SCORE = 250
REDDIT_CAP = 8000
CHUCK_CAP = 900
REDDIT_MAX_LEN = 900

ADULT_RE = re.compile(
    r"\b("
    r"nsfw|porn(?:o|ographic)?|xxx|onlyfans|orgasm|penis|vagina|blowjob|handjob|"
    r"dildo|vibrator|butt ?plug|anal|masturbat\w*|ejaculat\w*|cumshot|creampie|"
    r"threesome|gangbang|bdsm|bondage|horny|erection|viagra|motherfucker|"
    r"fuck(?:ing|ed|er|s)?|asshole|cock(?!tail|roach)|pussy|boobs?|titties|"
    r"\btits\b|\bdick(?:s|head)?\b|cunnilingus|fellatio|whore|slut|hooker|"
    r"prostitute|condom|sex toy|jerk(?:ing)? off|hand job|blow job"
    r")\b",
    re.I,
)
SLUR_RE = re.compile(
    r"\b(nigger|nigga|faggot|tranny|kike|spic|chink|wetback|retard(?:ed)?)\b",
    re.I,
)
GRAPHIC_RE = re.compile(r"\b(bestiality|snuff|csam|child porn)\b", re.I)
MINOR_RE = re.compile(
    r"\b(child|children|kid|kids|preteen|underage|minor|minors|toddler|infant|"
    r"schoolgirl|schoolboy|little boy|little girl)\b",
    re.I,
)
Q_A_RE = re.compile(r"^[Qq]:\s*(.+?)\s*[Aa]:\s*(.+)$", re.S)
STOP_BODY = {"[removed]", "[deleted]", "removed", "deleted"}

csv.field_size_limit(8 * 1024 * 1024)


def norm(text: str) -> str:
    t = html.unescape(text or "")
    t = t.replace("\r", "").replace("\u00a0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def joke_hash(body: str) -> str:
    key = re.sub(r"\s+", " ", body).lower().strip()
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def split_joke(text: str) -> tuple[str, str, str]:
    cleaned = norm(text)
    if not cleaned:
        return "", "", ""
    qa = Q_A_RE.match(cleaned)
    if qa:
        setup, punch = qa.group(1).strip(), qa.group(2).strip()
        if not setup.endswith("?"):
            setup = setup.rstrip(".")
        return setup, punch, cleaned
    qsplit = re.split(r"\?\s+", cleaned, maxsplit=1)
    if len(qsplit) == 2 and qsplit[0] and qsplit[1] and len(qsplit[0]) < 220:
        return qsplit[0].strip() + "?", qsplit[1].strip(), cleaned
    lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]
    if len(lines) >= 2:
        return lines[0], " ".join(lines[1:]), cleaned
    return "", cleaned, cleaned


def is_unsafe(body: str, rating: str) -> bool:
    if GRAPHIC_RE.search(body) or SLUR_RE.search(body):
        return True
    if rating == "adult" and MINOR_RE.search(body):
        return True
    return False


def rate(body: str, forced: str | None = None) -> str:
    if forced in ("clean", "adult"):
        return forced
    return "adult" if ADULT_RE.search(body) else "clean"


def cat(value: str, fallback: str) -> str:
    v = re.sub(r"[^a-z0-9 /+&-]+", "", (value or "").lower()).strip()
    v = re.sub(r"\s+", " ", v)[:40]
    return v or fallback


def keep(body: str, rating: str, max_len: int) -> bool:
    if len(body) < 12 or len(body) > max_len:
        return False
    low = body.lower().strip()
    if low in STOP_BODY:
        return False
    if "[removed]" in low or "[deleted]" in low:
        return False
    if re.match(r"https?://", body) and len(body) < 160:
        return False
    if is_unsafe(body, rating):
        return False
    letters = sum(ch.isalpha() for ch in body)
    if letters < 8:
        return False
    return True


class Catalog:
    def __init__(self) -> None:
        self.seen: set[str] = set()
        self.rows: list[dict] = []
        self.stats: dict[str, int] = {}

    def add(
        self,
        text: str,
        *,
        source: str,
        url: str = "",
        category: str = "general",
        score: int = 0,
        rating: str | None = None,
        setup: str | None = None,
        punchline: str | None = None,
        max_len: int = 1400,
    ) -> bool:
        body = norm(text)
        if setup is None or punchline is None:
            s, p, body = split_joke(body)
        else:
            s, p = norm(setup), norm(punchline)
            body = norm(f"{s} {p}".strip() if s else (p or body))
        r = rate(body, rating)
        if not keep(body, r, max_len):
            return False
        h = joke_hash(body)
        if h in self.seen:
            return False
        self.seen.add(h)
        self.rows.append(
            {
                "s": s[:500],
                "p": p[:1200],
                "b": body[:1400],
                "r": "a" if r == "adult" else "c",
                "c": cat(category, "general"),
                "n": source[:80],
                "u": (url or "")[:400],
                "k": int(score) if score else 0,
            }
        )
        self.stats[source] = self.stats.get(source, 0) + 1
        return True


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def add_official(catlg: Catalog) -> None:
    for row in load_json(RAW / "official-jokes.json"):
        setup = str(row.get("setup") or "")
        punch = str(row.get("punchline") or "")
        catlg.add(
            f"{setup} {punch}",
            source="Official Joke API",
            url="https://github.com/15Dkatz/official_joke_api",
            category=str(row.get("type") or "general"),
            score=80,
            rating="clean",
            setup=setup,
            punchline=punch,
        )


def add_jokeapi(catlg: Catalog) -> None:
    for row in load_json(RAW / "jokeapi-en.json"):
        flags = row.get("flags") or {}
        if flags.get("racist") or flags.get("sexist"):
            continue
        setup = str(row.get("setup") or "")
        punch = str(row.get("delivery") or row.get("joke") or "")
        nsfw = bool(flags.get("nsfw") or flags.get("explicit") or row.get("safe") is False)
        catlg.add(
            f"{setup} {punch}".strip(),
            source="JokeAPI",
            url="https://v2.jokeapi.dev/",
            category=str(row.get("category") or "general"),
            score=55,
            rating="adult" if nsfw else "clean",
            setup=setup or None,
            punchline=punch or None,
        )


def add_dad(catlg: Catalog) -> None:
    for row in load_json(RAW / "icanhazdadjoke.json"):
        joke = str(row.get("joke") or "")
        jid = str(row.get("id") or "")
        catlg.add(
            joke,
            source="icanhazdadjoke",
            url=f"https://icanhazdadjoke.com/j/{jid}" if jid else "https://icanhazdadjoke.com/",
            category="dad",
            score=70,
            rating="clean",
        )


def add_chuck(catlg: Catalog) -> None:
    data = load_json(RAW / "chuck-search.json")
    added = 0
    for row in data.get("result") or []:
        if added >= CHUCK_CAP:
            break
        val = str(row.get("value") or "")
        cats = row.get("categories") or []
        rating = "adult" if "explicit" in cats else None
        if catlg.add(
            val,
            source="Chuck Norris API",
            url=str(row.get("url") or "https://api.chucknorris.io/"),
            category="chuck",
            score=25,
            rating=rating,
            max_len=600,
        ):
            added += 1


def add_wocka(catlg: Catalog) -> None:
    adult_cats = {"adult", "dirty", "sexual", "blonde", "blond", "redneck", "bar jokes"}
    for row in load_json(RAW / "wocka.json"):
        title = str(row.get("title") or "")
        body = str(row.get("body") or "")
        category = str(row.get("category") or "general")
        text = f"{title}\n{body}" if title and title.lower() not in body.lower()[:80].lower() else body
        forced = "adult" if category.lower() in adult_cats else None
        catlg.add(
            text,
            source="Wocka (taivop/joke-dataset)",
            url="https://github.com/taivop/joke-dataset",
            category=category,
            score=35,
            rating=forced,
        )


def add_stupidstuff(catlg: Catalog) -> None:
    adult_cats = {"sexual", "blonde", "men", "women"}
    for row in load_json(RAW / "stupidstuff.json"):
        body = str(row.get("body") or "")
        category = str(row.get("category") or "general")
        try:
            rating_n = float(row.get("rating") or 0)
        except (TypeError, ValueError):
            rating_n = 0
        forced = "adult" if category.lower() in adult_cats else None
        catlg.add(
            body,
            source="StupidStuff (taivop/joke-dataset)",
            url="https://github.com/taivop/joke-dataset",
            category=category,
            score=20 + int(rating_n * 8),
            rating=forced,
        )


def add_csv_dump(catlg: Catalog, name: str, source: str, score: int, rating: str | None = None, category: str = "general") -> None:
    path = RAW / name
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            joke = row.get("Joke") or row.get("joke") or ""
            catlg.add(
                joke,
                source=source,
                url="https://github.com/amoudgl/short-jokes-dataset",
                category=category,
                score=score,
                rating=rating,
                max_len=500,
            )


def collect_reddit() -> list[tuple[int, str, str, str]]:
    """Return (score, text, url, source) for high-scoring reddit jokes."""
    out: list[tuple[int, str, str, str]] = []

    for row in load_json(RAW / "reddit_jokes.json"):
        try:
            score = int(row.get("score") or 0)
        except (TypeError, ValueError):
            score = 0
        if score < REDDIT_MIN_SCORE:
            continue
        title = str(row.get("title") or "")
        body = str(row.get("body") or "")
        if body.lower().strip() in STOP_BODY:
            continue
        text = f"{title}\n{body}" if body and body.lower() not in title.lower() else title
        if len(text) > REDDIT_MAX_LEN:
            continue
        rid = str(row.get("id") or "")
        url = f"https://www.reddit.com/r/Jokes/comments/{rid}/" if rid else "https://github.com/taivop/joke-dataset"
        out.append((score, text, url, "r/Jokes (taivop 2017)"))

    path = RAW / "one-million-reddit-jokes.csv"
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                score = int(float(row.get("score") or 0))
            except (TypeError, ValueError):
                score = 0
            if score < REDDIT_MIN_SCORE:
                continue
            title = str(row.get("title") or "")
            body = str(row.get("selftext") or "")
            if body.lower().strip() in STOP_BODY:
                continue
            text = f"{title}\n{body}" if body and body.lower() not in title.lower() else title
            if len(text) > REDDIT_MAX_LEN:
                continue
            permalink = str(row.get("permalink") or "")
            out.append((score, text, permalink or "https://huggingface.co/datasets/SocialGrep/one-million-reddit-jokes", "r/Jokes (SocialGrep 1M)"))

    out.sort(key=lambda x: -x[0])
    return out


def write_parts(rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("part-*.jsonl"):
        old.unlink()
    nparts = 0
    for i in range(0, len(rows), PART_SIZE):
        chunk = rows[i : i + PART_SIZE]
        path = OUT / f"part-{nparts:02d}.jsonl"
        with path.open("w", encoding="utf-8") as f:
            for row in chunk:
                f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        nparts += 1
        print(f"  wrote {path.name} ({len(chunk)} jokes, {path.stat().st_size} bytes)")
    meta = {
        "count": len(rows),
        "parts": nparts,
        "clean": sum(1 for r in rows if r["r"] == "c"),
        "adult": sum(1 for r in rows if r["r"] == "a"),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print("meta", meta)


def main() -> None:
    catlg = Catalog()
    print("official…")
    add_official(catlg)
    print("jokeapi…")
    add_jokeapi(catlg)
    print("dad…")
    add_dad(catlg)
    print("chuck…")
    add_chuck(catlg)
    print("wocka…")
    add_wocka(catlg)
    print("stupidstuff…")
    add_stupidstuff(catlg)
    print("short-jokes csvs…")
    add_csv_dump(catlg, "reddit-cleanjokes.csv", "r/cleanjokes (amoudgl)", 50, rating="clean", category="dad")
    add_csv_dump(catlg, "onelinefun.csv", "OneLineFun (amoudgl)", 40, category="one-liner")
    add_csv_dump(catlg, "funjokes.csv", "FunJokes (amoudgl)", 30, category="general")
    add_csv_dump(catlg, "thejokecafe.csv", "TheJokeCafe (amoudgl)", 30, category="general")
    add_csv_dump(catlg, "joke-db.csv", "JokeDB (amoudgl)", 25, category="general")
    curated = len(catlg.rows)
    print("curated", curated)
    print("reddit high-score…")
    reddit_added = 0
    for score, text, url, source in collect_reddit():
        if reddit_added >= REDDIT_CAP:
            break
        if catlg.add(
            text,
            source=source,
            url=url,
            category="reddit",
            score=score,
            max_len=REDDIT_MAX_LEN,
        ):
            reddit_added += 1
    print("sources", json.dumps(catlg.stats, indent=2))
    print("total", len(catlg.rows), "unique", "reddit_added", reddit_added)
    write_parts(catlg.rows)


if __name__ == "__main__":
    main()
