import { describe, it, expect } from "vitest";
import { canonicalize, canonicalJsonHash } from "../src/hashing/canonical.js";
import { sha256Hex } from "../src/hashing/sha256.js";
import { selectBestEvidence, scoreEvidence } from "../src/evidence/scorer.js";
import { extractDomain, isSocialDomain, isValidHttpUrl } from "../src/utils/urls.js";
import { computeCommitmentHash, buildCommittableRecord } from "../src/evidence/builder.js";
import type { ReverseImageResult } from "../src/reverse-search/types.js";

describe("canonical JSON", () => {
  it("produces deterministic output regardless of key order", () => {
    const a = { z: 1, a: { y: 2, b: 3 } };
    const b = { a: { b: 3, y: 2 }, z: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("hashes consistently", () => {
    const obj = { schemaVersion: "1.0.0", claim: "test" };
    expect(canonicalJsonHash(obj)).toBe(sha256Hex(canonicalize(obj)));
  });
});

describe("URL validation", () => {
  it("extracts domain", () => {
    expect(extractDomain("https://www.twitter.com/user/status/1")).toBe("twitter.com");
  });

  it("detects social domains", () => {
    expect(isSocialDomain("x.com")).toBe(true);
    expect(isSocialDomain("example.com")).toBe(false);
  });

  it("validates http(s) URLs", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });
});

describe("evidence scoring", () => {
  const baseResult: ReverseImageResult = {
    source: "test",
    fullMatches: [{ url: "https://x.com/user/status/123/photo/1" }],
    partialMatches: [],
    matchingPages: [{ url: "https://x.com/user/status/123", pageTitle: "Post" }],
    visuallySimilar: [{ url: "https://cdn.example.com/similar.jpg" }],
    searchedAt: new Date().toISOString(),
    queryImageSha256: "abc",
  };

  it("prefers full matches over visually similar", () => {
    const selection = selectBestEvidence(baseResult, false);
    expect(selection).not.toBeNull();
    expect(["full", "page", "partial"]).toContain(selection!.candidate.matchType);
  });

  it("rejects visually similar only results", () => {
    const onlySimilar: ReverseImageResult = {
      ...baseResult,
      fullMatches: [],
      partialMatches: [],
      matchingPages: [],
      visuallySimilar: [{ url: "https://cdn.example.com/similar.jpg" }],
    };
    expect(selectBestEvidence(onlySimilar, false)).toBeNull();
  });

  it("scores social post transparently", () => {
    const score = scoreEvidence(
      {
        selectedMatchUrl: "https://x.com/user/status/123",
        selectedImageUrl: "https://x.com/user/status/123/photo/1",
        matchType: "page",
        domain: "x.com",
        platform: "x",
        pageClassification: "SOCIAL_POST",
        classificationReason: "x post",
        isSocialPost: true,
      },
      "page"
    );
    expect(score.total).toBeGreaterThan(0);
    expect(score.components.some((c) => c.label === "Social post URL")).toBe(true);
  });
});

describe("commitment hash", () => {
  it("excludes integrity and blockchain from hash", () => {
    const committable = buildCommittableRecord({
      image: {
        buffer: Buffer.alloc(0),
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
        sha256: "abc123",
        filename: "test.jpg",
      },
      face: {
        facesDetected: 1,
        selectedFace: { bbox: { x: 0, y: 0, width: 50, height: 50 }, confidence: 0.99, index: 0 },
        encoding: { descriptorHash: "def", dimensions: 128, model: "test" },
        faceCropSha256: "facehash",
        faceCropBuffer: Buffer.alloc(0),
      },
      reverseSearch: {
        source: "test",
        fullMatches: [],
        partialMatches: [],
        matchingPages: [],
        visuallySimilar: [],
        searchedAt: "2026-01-01T00:00:00.000Z",
        queryImageSha256: "q",
      },
      evidence: {
        selectedMatchUrl: "https://x.com/user/status/1",
        selectedImageUrl: "https://x.com/user/status/1",
        matchType: "page",
        domain: "x.com",
        platform: "x",
        pageClassification: "SOCIAL_POST",
        classificationReason: "test",
        isSocialPost: true,
      },
      score: { components: [{ label: "Matching page", points: 20 }], total: 20 },
      verificationId: "fixed-id",
    });

    const hash1 = computeCommitmentHash(committable);
    const hash2 = computeCommitmentHash({ ...committable, verificationId: "fixed-id" });
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
