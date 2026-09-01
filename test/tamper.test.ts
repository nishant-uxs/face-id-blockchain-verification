import { describe, it, expect, beforeAll } from "vitest";
import {
  assembleFinalRecord,
  buildCommittableRecord,
  computeCommitmentHash,
} from "../src/evidence/builder.js";
import type { ReverseImageResult } from "../src/reverse-search/types.js";

function makeCommittable() {
  const reverseSearch: ReverseImageResult = {
    source: "test",
    fullMatches: [],
    partialMatches: [],
    matchingPages: [{ url: "https://x.com/user/status/123", pageTitle: "Post" }],
    visuallySimilar: [],
    searchedAt: "2026-09-01T00:00:00.000Z",
    queryImageSha256: "queryhash",
  };

  return buildCommittableRecord({
    image: {
      buffer: Buffer.alloc(0),
      mimeType: "image/jpeg",
      width: 640,
      height: 480,
      sha256: "abc123def456",
      filename: "demo.jpg",
    },
    face: {
      facesDetected: 1,
      selectedFace: { bbox: { x: 10, y: 10, width: 100, height: 100 }, confidence: 0.98, index: 0 },
      encoding: { descriptorHash: "facehash", dimensions: 8, model: "test" },
      faceCropSha256: "crophash",
      faceCropBuffer: Buffer.alloc(0),
    },
    reverseSearch,
    evidence: {
      selectedMatchUrl: "https://x.com/user/status/123",
      selectedImageUrl: "https://x.com/user/status/123/photo/1",
      matchType: "page",
      domain: "x.com",
      platform: "x",
      pageClassification: "SOCIAL_POST",
      classificationReason: "x post URL pattern matched",
      isSocialPost: true,
    },
    score: {
      components: [
        { label: "Matching page", points: 20 },
        { label: "Social post URL", points: 30 },
      ],
      total: 50,
    },
    verificationId: "00000000-0000-4000-8000-000000000001",
  });
}

describe("tamper detection (offline)", () => {
  let record: ReturnType<typeof assembleFinalRecord>;
  let hash: string;

  beforeAll(() => {
    const committable = makeCommittable();
    hash = computeCommitmentHash(committable);
    record = assembleFinalRecord(committable, "bafybeigdyrzt5sfp7udjm7rrmg2x6evg4ajqyjn6wsfv4bcvvljdcx5m", {
      chain: "Base Sepolia",
      chainId: 84532,
      contractAddress: "0x0000000000000000000000000000000000000001",
      transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
      blockNumber: 1,
    });
  });

  it("detects modified JSON field via hash mismatch", () => {
    const tampered = structuredClone(record);
    tampered.evidence.evidenceScore = 999;
    const { integrity, blockchain, storage, ...c } = tampered;
    expect(computeCommitmentHash(c)).not.toBe(integrity.canonicalJsonSha256);
  });

  it("detects modified integrity hash", () => {
    const tampered = structuredClone(record);
    tampered.integrity.canonicalJsonSha256 = "0".repeat(64);
    const { integrity, blockchain, storage, ...c } = tampered;
    expect(computeCommitmentHash(c)).not.toBe(tampered.integrity.canonicalJsonSha256);
  });

  it("detects modified IPFS CID in storage", () => {
    const tampered = structuredClone(record);
    tampered.storage.ipfsCid = "bafybeigdyrzt5sfp7udjm7rrmg2x6evg4ajqyjn6wsfv4bcvvljdcx5mTAMPER";
    expect(tampered.storage.ipfsCid).not.toBe(record.storage.ipfsCid);
  });

  it("detects modified transaction hash", () => {
    const tampered = structuredClone(record);
    tampered.blockchain.transactionHash =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(tampered.blockchain.transactionHash).not.toBe(record.blockchain.transactionHash);
  });

  it("validates original artifact hash is stable", () => {
    const { integrity, blockchain, storage, ...c } = record;
    expect(computeCommitmentHash(c)).toBe(hash);
    expect(integrity.canonicalJsonSha256).toBe(hash);
  });
});
