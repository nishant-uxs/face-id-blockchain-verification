import { isValidHttpUrl } from "../utils/urls.js";
import {
  classifyUrl,
  isAcceptableSocialEvidence,
  isReferenceArchiveDomain,
  type PageClassification,
  type SocialPlatform,
} from "../utils/social-classifier.js";
import type { ReverseImageResult } from "../reverse-search/types.js";

export type MatchType = "full" | "partial" | "page";

export interface EvidenceCandidate {
  selectedMatchUrl: string;
  selectedImageUrl: string;
  matchType: MatchType;
  domain: string | null;
  platform: SocialPlatform;
  pageClassification: PageClassification;
  classificationReason: string;
  pageTitle?: string;
  isSocialPost: boolean;
}

export interface EvidenceScore {
  components: Array<{ label: string; points: number }>;
  total: number;
}

const SCORE = {
  FULL_MATCH: 50,
  PARTIAL_MATCH: 30,
  MATCHING_PAGE: 20,
  SOCIAL_POST: 30,
  URL_CONSISTENCY: 10,
} as const;

export function scoreEvidence(candidate: EvidenceCandidate, matchType: MatchType): EvidenceScore {
  const components: EvidenceScore["components"] = [];

  if (matchType === "full") {
    components.push({ label: "Full image match", points: SCORE.FULL_MATCH });
  } else if (matchType === "partial") {
    components.push({ label: "Partial image match", points: SCORE.PARTIAL_MATCH });
  } else if (matchType === "page") {
    components.push({ label: "Matching page", points: SCORE.MATCHING_PAGE });
  }

  if (candidate.pageClassification === "SOCIAL_POST") {
    components.push({ label: "Social post URL", points: SCORE.SOCIAL_POST });
  }

  if (
    candidate.selectedImageUrl &&
    candidate.selectedMatchUrl &&
    classifyUrl(candidate.selectedImageUrl).domain === classifyUrl(candidate.selectedMatchUrl).domain
  ) {
    components.push({ label: "Image/page domain consistency", points: SCORE.URL_CONSISTENCY });
  }

  const total = components.reduce((sum, c) => sum + c.points, 0);
  return { components, total };
}

function pageUrlForCandidate(pageUrl: string, imageUrl: string): string {
  const pageClass = classifyUrl(pageUrl);
  if (pageClass.classification === "SOCIAL_POST") return pageUrl;
  const imageClass = classifyUrl(imageUrl);
  if (imageClass.classification === "SOCIAL_POST") return imageUrl;
  return pageUrl;
}

function isCandidateAllowed(
  pageUrl: string,
  requireSocialPost: boolean
): { allowed: boolean; classification: ReturnType<typeof classifyUrl> } {
  const pageClass = classifyUrl(pageUrl);

  if (isReferenceArchiveDomain(pageClass.domain)) {
    return { allowed: false, classification: pageClass };
  }

  if (requireSocialPost) {
    return {
      allowed: pageClass.classification === "SOCIAL_POST",
      classification: pageClass,
    };
  }

  // Non-strict mode: accept social posts, social pages, or general web (never CDN-only or visually similar)
  const allowed =
    pageClass.classification === "SOCIAL_POST" ||
    pageClass.classification === "PUBLIC_SOCIAL_PAGE" ||
    pageClass.classification === "GENERAL_WEB_PAGE";

  return { allowed, classification: pageClass };
}

export function selectBestEvidence(
  result: ReverseImageResult,
  requireSocialPost: boolean
): { candidate: EvidenceCandidate; score: EvidenceScore } | null {
  const candidates: Array<{
    candidate: EvidenceCandidate;
    matchType: MatchType;
    priority: number;
  }> = [];

  const addCandidate = (
    pageUrl: string,
    imageUrl: string,
    matchType: MatchType,
    pageTitle?: string,
    priority = 0
  ) => {
    if (!isValidHttpUrl(pageUrl) && !isValidHttpUrl(imageUrl)) return;

    const resolvedPageUrl = pageUrlForCandidate(
      isValidHttpUrl(pageUrl) ? pageUrl : imageUrl,
      isValidHttpUrl(imageUrl) ? imageUrl : pageUrl
    );

    const { allowed, classification } = isCandidateAllowed(resolvedPageUrl, requireSocialPost);
    if (!allowed) return;

    const imgUrl = isValidHttpUrl(imageUrl) ? imageUrl : resolvedPageUrl;

    candidates.push({
      candidate: {
        selectedMatchUrl: resolvedPageUrl,
        selectedImageUrl: imgUrl,
        matchType,
        domain: classification.domain,
        platform: classification.platform,
        pageClassification: classification.classification,
        classificationReason: classification.reason,
        pageTitle,
        isSocialPost: classification.classification === "SOCIAL_POST",
      },
      matchType,
      priority,
    });
  };

  for (const m of result.fullMatches) {
    addCandidate(m.url, m.url, "full", undefined, 100);
  }

  for (const m of result.partialMatches) {
    addCandidate(m.url, m.url, "partial", undefined, 80);
  }

  for (const p of result.matchingPages) {
    addCandidate(p.url, p.url, "page", p.pageTitle, 60);
  }

  for (const p of result.matchingPages) {
    for (const m of result.fullMatches) {
      addCandidate(p.url, m.url, "full", p.pageTitle, 95);
    }
    for (const m of result.partialMatches) {
      addCandidate(p.url, m.url, "partial", p.pageTitle, 85);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0]!;
  let bestScore =
    scoreEvidence(best.candidate, best.matchType).total +
    best.priority +
    (best.candidate.isSocialPost ? 50 : 0);

  for (const c of candidates.slice(1)) {
    const s =
      scoreEvidence(c.candidate, c.matchType).total +
      c.priority +
      (c.candidate.isSocialPost ? 50 : 0);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }

  const score = scoreEvidence(best.candidate, best.matchType);
  return { candidate: best.candidate, score };
}

export { isAcceptableSocialEvidence };
