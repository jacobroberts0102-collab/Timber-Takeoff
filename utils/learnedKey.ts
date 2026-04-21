/**
 * Shared logic for normalizing strings to be used in deterministic Map lookups.
 */

/**
 * Collapses internal whitespace runs into a single space and trims edges.
 * Preserves casing.
 */
export function normalizeWhitespace(value: string): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes dimension strings specifically for lookup keys.
 */
export function normalizeDimsForLookup(v: string): string {
  return normalizeWhitespace(v)
    .replace(/×/g, `x`)
    .replace(/\s*x\s*/gi, `x`)
    .toUpperCase();
}

/**
 * Builds a deterministic key for App Memory matching.
 * Format: "NORMALIZED NAME|NORMALIZED DIMS" (All Caps)
 */
export function buildLookupKey(itemName: string, dimensions: string | null | undefined): string {
  const name = normalizeWhitespace(itemName || "").toUpperCase();
  const dims = normalizeDimsForLookup(dimensions || "");
  // Replace slashes with underscores to avoid Firestore "Invalid document reference" errors
  return `${name}|${dims}`.replace(/\//g, '_');
}

/**
 * Backward compatibility alias for existing code
 */
export const buildMemoryKey = (itemName: string, dims?: string | null): string => {
    return buildLookupKey(itemName, dims || "");
};

/**
 * Takes an existing key string (with a |) and re-normalizes it into a lookup key.
 */
export const renormalizeFullKey = (fullKey: string): string => {
    const parts = fullKey.split('|');
    const item = parts[0] || "";
    const dims = parts.slice(1).join('|') || "";
    return buildLookupKey(item, dims);
};
