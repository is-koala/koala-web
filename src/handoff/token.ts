export type SearchValue = string | string[] | undefined;

export function readSingleToken(
  value: SearchValue,
): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const token = value.trim();
  if (!token || token.length > 2048) return { ok: false };
  return { ok: true, value: token };
}
