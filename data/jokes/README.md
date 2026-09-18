# Laugh4.LoL joke data

This folder is the on-disk joke archive. The live app loads the unique catalog
from [`public/jokes/vault.jsonl.gz`](../../public/jokes/vault.jsonl.gz)
(131,920 hashed bits). Schema lives in [`migrations/`](../../migrations/).
The house starter set is [`src/lib/jokes/seed.ts`](../../src/lib/jokes/seed.ts).

Rebuild the unique catalog:

```
python3 scripts/build-joke-catalog.py
```

## Unique vault

| File | What |
| --- | --- |
| `public/jokes/vault.jsonl.gz` | Deduped catalog the Stage + Vault import |
| `public/jokes/meta.json` | Counts: 131,920 unique / 119,348 clean / 12,572 late-show |

Each JSONL line: `{s, p, b, r, c, n, u, k}` — setup, punchline, body, rating (`c`/`a`), category, source, url, score.

## Raw open dumps (`raw/`)

Largest public joke datasets we could pull. Large files are gzipped so GitHub will take them (100 MB file cap).

| File | Source | Notes |
| --- | --- | --- |
| `wocka.json` | [taivop/joke-dataset](https://github.com/taivop/joke-dataset) | ~10k Wocka jokes |
| `stupidstuff.json` | taivop | ~3.7k StupidStuff |
| `reddit_jokes.json.gz` | taivop r/Jokes 2017 | ~195k posts |
| `one-million-reddit-jokes.csv.gz` | [SocialGrep 1M r/Jokes](https://huggingface.co/datasets/SocialGrep/one-million-reddit-jokes) | million-row dump |
| `reddit-jokes.csv.gz` | [amoudgl/short-jokes-dataset](https://github.com/amoudgl/short-jokes-dataset) | merged short r/Jokes |
| `reddit-cleanjokes.csv` | amoudgl | r/cleanjokes |
| `funjokes.csv` | amoudgl | FunJokes.net |
| `onelinefun.csv` | amoudgl | OneLineFun |
| `thejokecafe.csv` | amoudgl | TheJokeCafe |
| `joke-db.csv` | amoudgl | JokeDB |
| `funnytweeter.csv` | amoudgl | tweet-length bits |
| `funtweets.csv` | amoudgl | tweet-length bits |
| `official-jokes.json` | [15Dkatz/official_joke_api](https://github.com/15Dkatz/official_joke_api) | setup/punchline |
| `jokeapi-en.json` | [JokeAPI](https://v2.jokeapi.dev/) | English dump |
| `icanhazdadjoke.json` | [icanhazdadjoke](https://icanhazdadjoke.com/) | dad jokes |
| `chuck-search.json` | [api.chucknorris.io](https://api.chucknorris.io/) | Chuck search dump |
| `wesbos-dadjokes.json` | wesbos dad-style programming jokes | small markdown dump |

These dumps are third-party collections. We claim no ownership of the jokes.
The unique vault filters slurs, graphic harm, and adult+minor collisions before
Jester Bones sees them. Late-show bits stay behind the 18+ ID rope.
