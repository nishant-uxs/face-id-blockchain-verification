/**
 * Canonical JSON serialization for deterministic hashing.
 * Recursively sorts object keys; arrays preserve order.
 * (Key-sorted JSON — not full RFC 8785 JCS.)
 */
import { sha256Hex } from "./sha256.js";

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

export function canonicalJsonHash(record: unknown): string {
  return sha256Hex(canonicalize(record));
}
