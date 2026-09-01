# RESEARCH.md — HH Goa 2026 Task #3

## Challenge Requirements (Official)

Source: [hhgoa.com](https://hhgoa.com/) and [Task #3 Doc](https://docs.google.com/document/d/1i6VkPPa7bvNAp590icepw_T0nRq3awqiFE5yChgjry4/edit)

**Pipeline shape:** Face scan input → Web/social media search (find matching post) → Blockchain upload/verification

| Requirement | Detail |
|---|---|
| Face identification | Detect and encode a face from input image (any library/API) |
| Reverse image search | Find ≥1 **real, matching** social media post via **genuine** reverse-image search — **no hardcoded results** |
| Blockchain | Upload match data (or hash/fingerprint) for tamper-evident, re-verifiable record |
| No website | CLI pipeline only |
| GitHub | Source, README, how to run, blockchain used, limitations |
| Screen recording | Unedited end-to-end demo: face → social post found → blockchain verification |
| Deadline | Sept 7, 2026, 11:59 PM |

## Visual Identity (HH Goa 2026)

Observed from [hhgoa.com](https://hhgoa.com/) and prior Task #1 submissions:

| Token | Hex | Usage |
|---|---|---|
| Green (Ink) | `#0B6839` | Primary, headers, borders |
| Cream | `#FFFBE8` | Backgrounds |
| Yellow | `#FEE101` | Accents, CTAs |
| Pink | `#FF0080` | Highlights, badges |

**Typography:** Imbue (display), Victor Mono (data/mono)  
**Tone:** "Less Noise. More Signal" — technical, direct, playful but serious  
**Motifs:** ✦ bullet markers, Goa/Hacker House identity, terminal-first aesthetic

## Proposed Architecture

```
INPUT IMAGE
  → validate (MIME, size, dimensions)
  → face detect + crop + 128-D embedding hash
  → reverse-image search (Google Vision Web Detection)
  → evidence selection + transparent scoring
  → canonical verification JSON
  → SHA-256 commitment
  → IPFS upload (Pinata)
  → Base Sepolia on-chain anchor
  → local report + artifacts/verification.json

AUDIT: independently re-verify hashes, IPFS CID, chain record, tx receipt
```

## APIs Considered

| API | Purpose | Status |
|---|---|---|
| **Google Cloud Vision — Web Detection** | `fullMatchingImages`, `partialMatchingImages`, `pagesWithMatchingImages` | ✅ **Selected (primary)** — official, actively maintained |
| **SerpAPI Google Lens** | Reverse image via image upload | ✅ Optional secondary provider |
| **Bing Visual Search API** | Reverse image | ❌ **Retired Aug 11, 2025** |
| **TinEye API** | Reverse image | ❌ Paid, limited free tier, no social-page metadata |
| **lenso.ai API** | Face-focused reverse search | ❌ Rejected — face-similarity ≠ image provenance; privacy concerns |
| Face | Google Cloud Vision FACE_DETECTION + sharp crop | ✅ Selected — same GCP project as web detection, cross-platform |
| **sharp** | Image load/resize/crop | ✅ Selected |
| **Pinata SDK v2** | IPFS pin + public CID | ✅ Selected |
| **viem** | Base Sepolia deploy + write + read | ✅ Selected |
| **Base Sepolia** | EVM testnet, chainId 84532 | ✅ Selected |

## APIs Rejected and Why

1. **Bing Visual Search** — Microsoft retired all Bing Search APIs including Visual Search on August 11, 2025.
2. **Azure AI Foundry "Grounding with Bing"** — Platform commitment, not a drop-in reverse-image API.
3. **Scraping Google Images directly** — Fragile, ToS violation, breaks without notice.
4. **Hardcoded URL matching** — Explicitly forbidden by challenge; fails self-test.
5. **Face recognition as identity proof** — Out of scope; we use face processing for detection/metadata only.
6. **Storing raw embeddings on-chain** — Privacy risk; only content hash + IPFS CID on-chain.

## Final Technology Choices

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 + TypeScript (strict) |
| CLI | Commander + chalk + ora + boxen |
| Face | @vladmandic/face-api + @tensorflow/tfjs-node + sharp |
| Reverse search | @google-cloud/vision (WEB_DETECTION) |
| Optional fallback | SerpAPI `google_lens` (env: `SERPAPI_KEY`) |
| Hashing | Node crypto SHA-256 + RFC 8785 canonical JSON |
| IPFS | pinata SDK (`pinata.upload.public.json`) |
| Chain | Base Sepolia (84532), VerificationRegistry.sol, viem |
| Tests | vitest |
| Contract compile | solc (simple single-file) |

## Known Limitations

1. **Reverse-image index coverage** — Google Vision indexes publicly crawled web content; not every social post is indexed.
2. **Social platform detection** — We validate domains (twitter/x, instagram, linkedin, facebook, threads) but cannot guarantee a URL is a "post" vs profile page without fetching (we don't scrape authenticated content).
3. **Face embedding** — 128-D descriptor is for deterministic metadata only; not used for identity matching.
4. **Testnet** — Base Sepolia records are not permanent mainnet proofs.
5. **API costs** — Google Vision Web Detection is billed per image; Pinata has free tier limits.
6. **Demo reliability** — Requires a consenting subject whose image (or cropped variant) exists in Google's web index.

## Demo Strategy

1. **Consenting subject** posts a photo publicly (X/LinkedIn/Instagram) before the demo.
2. **Input image** is a locally cropped/resized variant of that public photo — not the identical file.
3. Pipeline discovers the match at runtime via Google Vision Web Detection.
4. **No URL is hardcoded** — evidence selection ranks `fullMatchingImages` > `partialMatchingImages` > `pagesWithMatchingImages`, preferring verified `SOCIAL_POST` URLs.
5. **`REQUIRE_SOCIAL_MATCH=true   # default — only SOCIAL_POST URLs qualify`** (default) — only URL patterns matching real social posts qualify (not profiles, CDN, or Wikimedia).
6. If no qualifying match: pipeline exits with `NO VERIFIED MATCH FOUND` — no fake record written.
7. Record unedited terminal session: `npm run verify` → `npm run audit`.

## Social URL Classification (implemented)

| Classification | Example | Accepted under strict mode? |
|---|---|---|
| `SOCIAL_POST` | `x.com/user/status/123`, `instagram.com/p/ABC` | ✅ Yes |
| `PUBLIC_SOCIAL_PAGE` | `x.com/user`, `instagram.com/user` | ❌ No |
| `IMAGE_CDN` | `pbs.twimg.com/media/...` | ❌ No |
| `GENERAL_WEB_PAGE` | `wikipedia.org`, `example.com` | ❌ No |

Implemented in `src/utils/social-classifier.ts` with proper URL parsing per platform.

## Provider Comparison (run locally)

```bash
npm run compare-providers -- ./samples/demo.jpg
```

| Criterion | Google Vision Web Detection | SerpAPI Google Lens |
|---|---|---|
| API status (2026) | Active — official GCP | Active — third-party |
| Full/partial/page matches | ✅ Native fields | ⚠️ visual_matches only |
| Social post discovery | Good for indexed pages | Often better for recent social |
| Latency | ~1–3s typical | ~2–5s typical |
| Primary for demo | ✅ Default | Optional secondary |

**Decision:** Keep Google Vision as primary (same credential as face detection). Use SerpAPI as optional fallback via `SERPAPI_KEY`. Run `compare-providers` on your demo image to confirm which finds the consenting subject's post before recording.

## Environment Variables

```
GOOGLE_APPLICATION_CREDENTIALS=   # Path to GCP service account JSON
PINATA_JWT=                       # Pinata API JWT
PINATA_GATEWAY=                   # e.g. gateway.pinata.cloud
RPC_URL=                          # https://sepolia.base.org
PRIVATE_KEY=                      # Deployer/submitter wallet (testnet only)
CONTRACT_ADDRESS=                 # Deployed VerificationRegistry
SERPAPI_KEY=                      # Optional secondary reverse-search provider
```
