# Artifact schema (verification.json)

Every successful `npm run verify` writes `artifacts/verification.json` (gitignored locally).

## Shape

```json
{
  "schemaVersion": "1.0.0",
  "verificationId": "uuid",
  "createdAt": "ISO-8601",
  "claim": "Evidence found for a matching image/page — not proof of personal identity",
  "input": {
    "filename": "demo.jpg",
    "mimeType": "image/jpeg",
    "sha256": "…",
    "width": 640,
    "height": 480
  },
  "faceDetection": {
    "facesDetected": 1,
    "selectedFace": { "bbox": { "x": 0, "y": 0, "width": 100, "height": 100 }, "confidence": 0.9, "index": 0 },
    "encoding": { "descriptorHash": "…", "dimensions": 128, "model": "…" },
    "faceCropSha256": "…"
  },
  "reverseImageSearch": {
    "source": "SerpAPI — Google Lens",
    "fullMatches": [{ "url": "https://…" }],
    "partialMatches": [],
    "matchingPages": [{ "url": "https://…", "pageTitle": "…" }],
    "visuallySimilar": [],
    "searchedAt": "ISO-8601",
    "queryImageSha256": "…"
  },
  "evidence": {
    "selectedMatchUrl": "https://…/status/…",
    "selectedImageUrl": "https://…",
    "matchType": "full|partial|page",
    "domain": "x.com",
    "platform": "x",
    "pageClassification": "SOCIAL_POST",
    "classificationReason": "…",
    "evidenceScore": 80,
    "scoreBreakdown": [{ "label": "Full image match", "points": 50 }],
    "isSocialPost": true
  },
  "integrity": { "canonicalJsonSha256": "…" },
  "storage": { "ipfsCid": "bafy…" },
  "blockchain": {
    "chain": "Ethereum Sepolia",
    "chainId": 11155111,
    "contractAddress": "0x…",
    "transactionHash": "0x…",
    "blockNumber": 123
  }
}
```

## Commitment rule

`integrity.canonicalJsonSha256` hashes the **committable** object only — everything **except** `integrity`, `storage`, and `blockchain`.

`audit` recomputes that hash, re-fetches IPFS, re-classifies `selectedMatchUrl`, and checks the Sepolia receipt targets the registry contract.
