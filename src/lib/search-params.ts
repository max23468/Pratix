export function parseTextSearch(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

export function parseSearchValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): T | undefined {
  return typeof value === "string" && allowedValues.includes(value as T) ? (value as T) : undefined;
}

export function parseLooseSelectValue(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

export function normalizeTextSearch(value: string) {
  return value.trim() || undefined;
}
