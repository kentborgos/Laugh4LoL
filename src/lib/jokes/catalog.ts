export const CATALOG_MARKER = "Catalog: taivop/joke-dataset";

export const CATALOG_META = {
  count: 45081,
  parts: 19,
  clean: 41827,
  adult: 3254,
} as const;

export function isCatalogSource(name: string) {
  return name.startsWith("Catalog:");
}
