import { SOCIAL_DOMAINS } from "../config/brand.js";

export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isSocialDomain(domain: string | null): boolean {
  if (!domain) return false;
  return SOCIAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}
