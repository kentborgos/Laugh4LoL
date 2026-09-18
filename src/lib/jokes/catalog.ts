export const CATALOG_MARKER = "Catalog: taivop/joke-dataset";

export const CATALOG_META = {
  count: 131920,
  parts: 53,
  clean: 119348,
  adult: 12572,
} as const;

export function isCatalogSource(name: string) {
  return name.startsWith("Catalog:");
}
