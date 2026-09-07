# For Judges — 90-second brief

**Repo:** [face-id-blockchain-verification](https://github.com/nishant-uxs/face-id-blockchain-verification)  
**Task:** HH Goa 2026 Task #3 — Face ID + Blockchain Verification  
**Surface:** CLI only (no website, by design)

## What this does

```text
photo → local face detect → live reverse-image search → score SOCIAL_POST
      → pin JSON on IPFS → anchor hash+CID on Ethereum Sepolia → audit
```

**Claim stored in every record:**  
*"Evidence found for a matching image/page — not proof of personal identity"*

## How to verify the repo without trusting us

| Check | Command / place |
|---|---|
| Anti-hardcoding | `npm run self-test` |
| Offline integrity / tamper | `npm test` (24 tests) |
| Typecheck | `npm run typecheck` |
| Full offline gate | `npm run check` |
| Strict social policy | `.env.example` → `REQUIRE_SOCIAL_MATCH=true` |
| Visually-similar rejected | `src/evidence/scorer.ts` — only full/partial/page |
| Live APIs | `src/reverse-search/serpapi.ts` → `serpapi.com` |
| Chain | Ethereum Sepolia `11155111` — `contracts/VerificationRegistry.sol` |
| Independent audit | `npm run audit -- <json> --image <img>` |

## Stack (honest)

| Layer | Choice |
|---|---|
| Face | Local `@vladmandic/face-api` (no GCP billing required) |
| Reverse search | **SerpAPI Google Lens** primary (+ exact + reverse image) |
| Optional secondary | Google Vision Web Detection |
| Storage | Pinata IPFS |
| Chain | Ethereum Sepolia + `VerificationRegistry` |

## What is / isn’t on-chain

| On-chain | Not on-chain |
|---|---|
| `recordHash`, `ipfsCid`, timestamp, submitter | Raw photo, face embeddings, API keys |

## Exit codes (`verify`)

| Code | Meaning |
|---|---|
| `0` | VERIFIED |
| `1` | Config / provider / chain error |
| `2` | NO VERIFIED MATCH — **no fake JSON, no fake tx** |

## Reproduce live (credentials required)

```bash
npm install
cp .env.example .env   # SERPAPI_KEY, PINATA_JWT, PRIVATE_KEY, CONTRACT_ADDRESS
npm run deploy         # once
npm run verify -- ./samples/demo.jpg
npm run audit -- ./artifacts/verification.json --image ./samples/demo.jpg
```

Demo photo must already exist as a **public social post** (indexed). Profile DP alone is often insufficient — see [DEMO.md](./DEMO.md) and [LIMITATIONS.md](./LIMITATIONS.md).

## Read next

1. [README.md](./README.md) — architecture Mermaid + full runbook  
2. [SECURITY.md](./SECURITY.md) — privacy boundary (incl. temporary Lens face-crop)  
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — commitment model  
