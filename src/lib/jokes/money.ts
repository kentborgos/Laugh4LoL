export function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function parseDollars(value: string) {
  const n = Number.parseFloat(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
