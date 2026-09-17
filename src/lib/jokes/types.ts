export type JokeRating = "clean" | "adult";

export type Joke = {
  id: number;
  setup: string;
  punchline: string;
  body: string;
  rating: JokeRating;
  category: string;
  sourceName: string;
  sourceUrl: string;
  createdAt: string;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type CrawlSource = {
  id: number;
  name: string;
  url: string;
  kind: "api" | "site" | "forum";
  rating: JokeRating;
  lastCrawled: string | null;
  lastStatus: string;
  lastError: string | null;
  enabled: boolean;
};

export type CrawlRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  foundCount: number;
  savedCount: number;
  status: string;
};

export type VaultStats = {
  total: number;
  clean: number;
  adult: number;
  sources: number;
  lastCrawl: string | null;
};
