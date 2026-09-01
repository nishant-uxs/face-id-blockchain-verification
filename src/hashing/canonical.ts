/**
 * Canonical JSON serialization (deterministic hashing).
 * Sorts object keys recursively; arrays preserve order.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortValue(obj[key]);
  }
  return sorted;
}

import { sha256Hex } from "./sha256.js";

export function canonicalJsonHash(record: unknown): string {
  return sha256Hex(canonicalize(record));
}
