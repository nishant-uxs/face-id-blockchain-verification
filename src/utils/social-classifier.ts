/**
 * Central classification for reverse-image evidence URLs.
 * Uses proper URL parsing — never url.includes("twitter").
 */

export type PageClassification =
  | "SOCIAL_POST"
  | "PUBLIC_SOCIAL_PAGE"
  | "IMAGE_CDN"
  | "GENERAL_WEB_PAGE";

export type SocialPlatform =
  | "x"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "facebook"
  | "threads"
  | "tiktok"
  | "youtube"
  | "reddit"
  | null;

export interface UrlClassification {
  url: string;
  domain: string | null;
  platform: SocialPlatform;
  classification: PageClassification;
  reason: string;
}

const PLATFORM_DOMAINS: Record<string, SocialPlatform> = {
  "x.com": "x",
  "twitter.com": "twitter",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "threads.net": "threads",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "reddit.com": "reddit",
};

const IMAGE_CDN_DOMAINS = new Set([
  "pbs.twimg.com",
  "abs.twimg.com",
  "cdninstagram.com",
  "scontent.cdninstagram.com",
  "media.licdn.com",
  "fbcdn.net",
]);

function resolvePlatform(hostname: string): SocialPlatform {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (PLATFORM_DOMAINS[host]) return PLATFORM_DOMAINS[host]!;
  for (const [domain, platform] of Object.entries(PLATFORM_DOMAINS)) {
    if (host.endsWith(`.${domain}`)) return platform;
  }
  return null;
}

function isImageCdn(hostname: string): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (IMAGE_CDN_DOMAINS.has(host)) return true;
  return host.endsWith(".fbcdn.net") || host.endsWith(".cdninstagram.com");
}

function classifySocialPath(platform: SocialPlatform, pathname: string): PageClassification {
  const path = pathname.toLowerCase();

  switch (platform) {
    case "x":
    case "twitter":
      if (/\/status\/\d+/.test(path)) return "SOCIAL_POST";
      if (/^\/[^/]+\/?$/.test(path) && !path.includes("/status/")) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "instagram":
      if (/^\/(p|reel|tv)\/[a-zA-Z0-9_-]+/.test(path)) return "SOCIAL_POST";
      if (/^\/[a-zA-Z0-9._]+\/?$/.test(path)) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "linkedin":
      if (path.includes("/posts/") || path.includes("/feed/update/") || path.includes("/pulse/")) {
        return "SOCIAL_POST";
      }
      if (path.includes("/in/") || path.includes("/company/")) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "facebook":
      if (
        path.includes("/posts/") ||
        path.includes("/photos/") ||
        path.includes("/photo.php") ||
        path.includes("/permalink.php") ||
        path.includes("/story.php")
      ) {
        return "SOCIAL_POST";
      }
      if (/^\/[^/]+\/?$/.test(path) || path.includes("/profile.php")) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "threads":
      if (/\/post\/[a-zA-Z0-9_-]+/.test(path)) return "SOCIAL_POST";
      if (/^\/@[^/]+\/?$/.test(path)) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "tiktok":
      if (/\/@[^/]+\/video\/\d+/.test(path)) return "SOCIAL_POST";
      if (/^\/@[^/]+\/?$/.test(path)) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "youtube":
      if (path.includes("/watch") || path.includes("/shorts/")) return "SOCIAL_POST";
      if (path.includes("/channel/") || path.includes("/@")) return "PUBLIC_SOCIAL_PAGE";
      return "GENERAL_WEB_PAGE";

    case "reddit":
      if (path.includes("/comments/")) return "SOCIAL_POST";
      if (path.startsWith("/r/") || path.startsWith("/u/") || path.startsWith("/user/")) {
        return "PUBLIC_SOCIAL_PAGE";
      }
      return "GENERAL_WEB_PAGE";

    default:
      return "GENERAL_WEB_PAGE";
  }
}

export function classifyUrl(url: string): UrlClassification {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const platform = resolvePlatform(domain);

    if (isImageCdn(domain)) {
      return {
        url,
        domain,
        platform,
        classification: "IMAGE_CDN",
        reason: `Image CDN host: ${domain}`,
      };
    }

    if (!platform) {
      return {
        url,
        domain,
        platform: null,
        classification: "GENERAL_WEB_PAGE",
        reason: `Non-social domain: ${domain}`,
      };
    }

    const classification = classifySocialPath(platform, parsed.pathname);
    const reason =
      classification === "SOCIAL_POST"
        ? `${platform} post URL pattern matched`
        : classification === "PUBLIC_SOCIAL_PAGE"
          ? `${platform} profile/page URL (not a post)`
          : `${platform} URL on social domain but not a recognized post`;

    return { url, domain, platform, classification, reason };
  } catch {
    return {
      url,
      domain: null,
      platform: null,
      classification: "GENERAL_WEB_PAGE",
      reason: "Invalid URL",
    };
  }
}

/** Returns true only for verified social POST URLs (not profiles, CDN, or general web). */
export function isAcceptableSocialEvidence(url: string): boolean {
  return classifyUrl(url).classification === "SOCIAL_POST";
}

/** Wikimedia and similar reference sites are never acceptable for strict social demo. */
export function isReferenceArchiveDomain(domain: string | null): boolean {
  if (!domain) return false;
  const blocked = ["wikimedia.org", "wikipedia.org", "commons.wikimedia.org"];
  return blocked.some((d) => domain === d || domain.endsWith(`.${d}`));
}
