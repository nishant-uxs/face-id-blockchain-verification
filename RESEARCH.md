# RESEARCH.md — HH Goa 2026 Task #3

## Challenge Requirements (Official)

Source: [hhgoa.com](https://hhgoa.com/) and Task #3 brief

**Pipeline shape:** Face scan input → Web/social media search (find matching post) → Blockchain upload/verification

| Requirement | Detail |
|---|---|
| Face identification | Detect and encode a face from input image (any library/API) |
| Reverse image search | Find ≥1 **real, matching** social media post via **genuine** reverse-image search — **no hardcoded results** |
| Blockchain | Upload match data (or hash/fingerprint) for tamper-evident, re-verifiable record |
| No website | CLI pipeline only |
| GitHub | Source, README, how to run, blockchain used, limitations |
| Screen recording | Unedited end-to-end demo: face → social post found → blockchain verification |

## Visual Identity (HH Goa 2026)

| Token | Hex | Usage |
|---|---|---|
| Green (Ink) | `#0B6839` | Primary, headers, borders |
| Cream | `#FFFBE8` | Backgrounds |
| Yellow | `#FEE101` | Accents, CTAs |
| Pink | `#FF0080` | Highlights, badges |

**Tone:** "Less Noise. More Signal" — technical, direct, terminal-first

## Proposed Architecture

```
INPUT IMAGE
  → validate (MIME, size, dimensions)
  → local face-api detect + crop + 128-D descriptor hash
  → reverse-image search (SerpAPI Lens primary; Vision optional)
  → evidence selection + transparent scoring
  → canonical verification JSON
  → SHA-256 commitment (key-sorted JSON)
  → IPFS upload (Pinata)
  → Ethereum Sepolia on-chain anchor
  → local report + artifacts/verification.json

AUDIT: independently re-verify hashes, IPFS CID, URL class, chain record, tx receipt
```

## APIs Considered

| API | Purpose | Status |
|---|---|---|
| **SerpAPI Google Lens** | Reverse image via public image URL | ✅ **Selected (primary)** |
| **Google Cloud Vision — Web Detection** | `fullMatchingImages` / pages | ✅ Optional secondary |
| **Bing Visual Search API** | Reverse image | ❌ Retired Aug 11, 2025 |
| **TinEye API** | Reverse image | ❌ Paid, limited social-page metadata |
| **lenso.ai API** | Face-focused reverse search | ❌ Face-similarity ≠ image provenance |
| Face | `@vladmandic/face-api` + sharp crop | ✅ Selected — local, no GCP billing for face |
| **sharp** | Image load/resize/crop | ✅ Selected |
| **Pinata SDK v2** | IPFS pin + public CID | ✅ Selected |
| **viem** | Sepolia deploy + write + read | ✅ Selected |
| **Ethereum Sepolia** | EVM testnet, chainId `11155111` | ✅ Selected |

## APIs Rejected and Why

1. **Bing Visual Search** — retired August 11, 2025.
2. **Scraping Google Images directly** — fragile, ToS risk.
3. **Hardcoded URL matching** — forbidden; fails self-test.
4. **Face recognition as identity proof** — out of scope.
5. **Storing raw embeddings on-chain** — privacy risk.
6. **Base Sepolia as primary demo chain** — faucet friction for demos; switched to Ethereum Sepolia.

## Final Technology Choices

| Layer | Choice |
|---|---|
| Runtime | Node.js 20–22 + TypeScript |
| CLI | Commander + chalk + boxen |
| Face | `@vladmandic/face-api` + `@tensorflow/tfjs` (+ canvas) |
| Reverse search | SerpAPI `google_lens` / `exact_matches` / `google_reverse_image` |
| Optional secondary | Google Vision `WEB_DETECTION` |
| Hashing | Node crypto SHA-256 + deterministic key-sorted JSON |
| IPFS | Pinata SDK |
| Chain | Ethereum Sepolia (`11155111`), `VerificationRegistry.sol`, viem |
| Tests | vitest |

## Known Limitations

1. Reverse-image index coverage is incomplete for fresh posts.
2. URL classification distinguishes post-like paths but cannot fetch private content.
3. Descriptor hash is metadata — not identity matching.
4. Sepolia is a testnet — not a permanent mainnet proof.
5. Face crop is temporarily public for Lens queries.
6. Demo needs a real public **post**, not only a profile picture.

## Demo Strategy

1. Consenting subject posts the photo publicly (LinkedIn / X / Instagram **post**).
2. Wait for indexing; confirm with `npm run compare-providers`.
3. Record unedited `verify` → explorer → `audit` in one take.

See [DEMO.md](./DEMO.md), [LIMITATIONS.md](./LIMITATIONS.md), [SECURITY.md](./SECURITY.md).
