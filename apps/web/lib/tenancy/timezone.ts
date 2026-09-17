const aliases: Record<string, string> = {
  "asia/kolkata": "Asia/Kolkata",
  "asia/calcutta": "Asia/Calcutta",
  utc: "UTC",
};

export function canonicalizeIanaTimeZone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const alias = aliases[trimmed.toLowerCase()];
  if (alias) return alias;

  const supported = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone").find((zone) => zone.toLowerCase() === trimmed.toLowerCase())
    : undefined;
  if (supported) return supported;

  try {
    return new Intl.DateTimeFormat("en", { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
