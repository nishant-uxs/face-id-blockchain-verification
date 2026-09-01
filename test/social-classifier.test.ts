import { describe, it, expect } from "vitest";
import {
  classifyUrl,
  isAcceptableSocialEvidence,
  isReferenceArchiveDomain,
} from "../src/utils/social-classifier.js";
import { selectBestEvidence } from "../src/evidence/scorer.js";
import type { ReverseImageResult } from "../src/reverse-search/types.js";

describe("social classifier", () => {
  it("classifies X/Twitter status URLs as SOCIAL_POST", () => {
    const c = classifyUrl("https://x.com/builder/status/1234567890");
    expect(c.classification).toBe("SOCIAL_POST");
    expect(c.platform).toBe("x");
  });

  it("classifies X profile URLs as PUBLIC_SOCIAL_PAGE", () => {
    const c = classifyUrl("https://x.com/somebuilder");
    expect(c.classification).toBe("PUBLIC_SOCIAL_PAGE");
  });

  it("classifies Instagram post URLs as SOCIAL_POST", () => {
    const c = classifyUrl("https://www.instagram.com/p/ABC123xyz/");
    expect(c.classification).toBe("SOCIAL_POST");
    expect(c.platform).toBe("instagram");
  });

  it("classifies Instagram profiles as PUBLIC_SOCIAL_PAGE", () => {
    const c = classifyUrl("https://www.instagram.com/somebuilder/");
    expect(c.classification).toBe("PUBLIC_SOCIAL_PAGE");
  });

  it("classifies LinkedIn posts as SOCIAL_POST", () => {
    expect(classifyUrl("https://www.linkedin.com/posts/user_activity-123").classification).toBe(
      "SOCIAL_POST"
    );
  });

  it("classifies image CDN hosts separately", () => {
    const c = classifyUrl("https://pbs.twimg.com/media/abc.jpg");
    expect(c.classification).toBe("IMAGE_CDN");
    expect(isAcceptableSocialEvidence("https://pbs.twimg.com/media/abc.jpg")).toBe(false);
  });

  it("classifies Wikimedia as general web", () => {
    const c = classifyUrl("https://upload.wikimedia.org/wikipedia/commons/a/ab/Face.jpg");
    expect(c.classification).toBe("GENERAL_WEB_PAGE");
    expect(isReferenceArchiveDomain(c.domain)).toBe(true);
  });

  it("rejects Wikimedia under strict social match", () => {
    const result: ReverseImageResult = {
      source: "test",
      fullMatches: [],
      partialMatches: [],
      matchingPages: [
        {
          url: "https://en.wikipedia.org/wiki/Some_Person",
          pageTitle: "Wiki",
        },
      ],
      visuallySimilar: [],
      searchedAt: new Date().toISOString(),
      queryImageSha256: "abc",
    };
    expect(selectBestEvidence(result, true)).toBeNull();
  });

  it("accepts social post under strict match", () => {
    const result: ReverseImageResult = {
      source: "test",
      fullMatches: [],
      partialMatches: [],
      matchingPages: [{ url: "https://x.com/user/status/999", pageTitle: "Post" }],
      visuallySimilar: [{ url: "https://cdn.example.com/similar.jpg" }],
      searchedAt: new Date().toISOString(),
      queryImageSha256: "abc",
    };
    const sel = selectBestEvidence(result, true);
    expect(sel).not.toBeNull();
    expect(sel!.candidate.pageClassification).toBe("SOCIAL_POST");
    expect(sel!.candidate.isSocialPost).toBe(true);
  });

  it("rejects profile-only under strict match", () => {
    const result: ReverseImageResult = {
      source: "test",
      fullMatches: [],
      partialMatches: [],
      matchingPages: [{ url: "https://x.com/someuser", pageTitle: "Profile" }],
      visuallySimilar: [],
      searchedAt: new Date().toISOString(),
      queryImageSha256: "abc",
    };
    expect(selectBestEvidence(result, true)).toBeNull();
  });
});
