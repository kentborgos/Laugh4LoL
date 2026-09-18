import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { readAgeToken } from "./age-token";
import { verifyAge, type AgeInput } from "./age.server";
import { importOpenCatalog, maybeCrawl, runCrawl, seedIfEmpty } from "./crawl.server";
import { CATALOG_META } from "./catalog";
import { riffWithGrok } from "./comedian.server";
import { consumeAiQuota } from "./billing.server";
import type { CrawlRun, CrawlSource, Joke, VaultStats } from "./types";

function isAdult(token?: string | null) {
  return readAgeToken(token)?.adult === true;
}
