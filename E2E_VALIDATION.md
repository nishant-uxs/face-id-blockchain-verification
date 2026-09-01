# E2E Validation Report

> Status: **BLOCKED — credentials not configured in validation environment**

This document records red-team and end-to-end validation results. Update after running with real credentials.

## Prerequisites Checklist

- [ ] `GOOGLE_APPLICATION_CREDENTIALS` — service account with Vision API enabled
- [ ] `PINATA_JWT` — Pinata API token
- [ ] `PRIVATE_KEY` — Base Sepolia testnet wallet with ETH
- [ ] `CONTRACT_ADDRESS` — deployed VerificationRegistry
- [ ] `SERPAPI_KEY` (optional) — for provider comparison
- [ ] Consenting subject photo posted publicly on social media
- [ ] Local `samples/demo.jpg` — cropped/resized derivative (not identical file)

## Automated Tests (no credentials required)

| Test Suite | Command | Status |
|---|---|---|
| Unit tests | `npm test` | Run locally |
| Self-test (anti-hardcode) | `npm run self-test` | Run locally |
| Failure modes | `npm run test:failure` | Run locally |
| Tamper detection (offline) | included in `npm test` | Run locally |
| TypeScript | `npx tsc --noEmit` | Run locally |

## E2E Pipeline (requires credentials)

```bash
npm run verify -- ./samples/demo.jpg
npm run audit -- ./artifacts/verification.json --image ./samples/demo.jpg
```

| Step | Expected | Actual | Status |
|---|---|---|---|
| Face detection (Google Vision API) | Real API call | _pending_ | ⏳ |
| Reverse-image search | Real API call | _pending_ | ⏳ |
| Social post discovered | SOCIAL_POST classification | _pending_ | ⏳ |
| IPFS upload | Real CID returned | _pending_ | ⏳ |
| Blockchain anchor | Real tx on Base Sepolia | _pending_ | ⏳ |
| Independent audit | VERIFICATION VALID | _pending_ | ⏳ |

## Provider Comparison

```bash
npm run compare-providers -- ./samples/demo.jpg
```

| Provider | Social Posts Found | Latency | Strict Match | Notes |
|---|---|---|---|---|
| Google Vision Web Detection | _pending_ | _pending_ | _pending_ | |
| SerpAPI Google Lens | _pending_ | _pending_ | _pending_ | |

## Tamper Tests (requires valid artifact)

| Test | Expected | Actual | Status |
|---|---|---|---|
| A. Modify verification.json field | FAIL | _pending_ | ⏳ |
| B. Change input image | FAIL | _pending_ | ⏳ |
| C. Change IPFS CID | FAIL | _pending_ | ⏳ |
| D. Change transaction hash | FAIL | _pending_ | ⏳ |
| E. Restore original artifact | VALID | _pending_ | ⏳ |

Offline hash tamper tests pass in `test/tamper.test.ts`.

## Red-Team Audit Findings

### Verified (code inspection)

- ✅ Google Vision `annotateImage` called for face + web detection
- ✅ SerpAPI `fetch` to `serpapi.com` when configured
- ✅ No hardcoded social post URLs in `src/`
- ✅ No mock reverse-search providers in production path
- ✅ `visuallySimilar` never selected as evidence
- ✅ `REQUIRE_SOCIAL_MATCH=true` by default — only `SOCIAL_POST` URLs accepted
- ✅ Wikimedia/reference domains explicitly rejected under strict mode
- ✅ Secrets redacted in CLI error output
- ✅ `.env` in `.gitignore`
- ✅ On-chain storage: `recordHash` (bytes32) + `ipfsCid` only — no biometrics

### Fixed in this validation pass

- 🔧 Social classification upgraded from domain-only to URL-pattern-based `SOCIAL_POST` detection
- 🔧 Default `REQUIRE_SOCIAL_MATCH=true`
- 🔧 Three distinct exit states: VERIFIED (0), PIPELINE ERROR (1), NO MATCH (2)
- 🔧 Audit enhanced: chain ID, contract bytecode, event log verification
- 🔧 Audit UI restructured into sections

### Cannot verify without credentials

- ⏳ Real E2E pipeline execution
- ⏳ Provider comparison on live image
- ⏳ On-chain tamper tests against real artifact

## Judge Review Checklist

| Question | Answer |
|---|---|
| Is reverse-image search genuine? | Code calls real APIs; E2E pending credentials |
| Is result discovered not hardcoded? | Self-test + no URLs in src; E2E pending |
| Can evidence be opened independently? | IPFS CID in output; E2E pending |
| Can blockchain tx be verified? | Audit reads receipt + event; E2E pending |
| Does tamper detection work? | Offline tests pass; live tests pending |
| Is privacy boundary clear? | Yes — documented in SECURITY.md |
| Understandable in 2 minutes? | CLI shows 8 clear steps |
| Anything misleading? | Wikimedia sample removed from submission path |
