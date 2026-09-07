# Security & Privacy

## Privacy Boundary

This system is designed for **consenting demo subjects** only.

- We do **not** attempt to identify unknown persons
- We do **not** treat a matched name as proof of identity
- The claim is: **"Evidence found for a matching image/page"**

## Data Stored

### On IPFS (public)

**Verification JSON (permanent pin for the demo record):**

- Input image metadata (filename, SHA-256, dimensions) — **not the original full image**
- Face bounding box + confidence + encoding **hash** — **not raw float embeddings**
- Full reverse-image search API response (may include many unrelated URLs)
- Selected evidence URLs and score breakdown

**Temporary Lens query image:**

- A resized **face-crop JPEG** is uploaded to Pinata so SerpAPI Google Lens can fetch a public `https://…/ipfs/<cid>` URL
- This is biometric-adjacent imagery on a public gateway — use only with consent; unpin after demos when possible

### On-chain (public)

- `recordHash` (SHA-256 of committable JSON)
- `ipfsCid`
- `timestamp`
- `submitter` address

### Never stored on-chain

- Raw face embeddings
- Biometric templates
- API keys or secrets
- Full-resolution input photos

## Secrets Management

All secrets via environment variables:

```
SERPAPI_KEY                 # recommended primary reverse-search
PINATA_JWT
PRIVATE_KEY                 # testnet only
CONTRACT_ADDRESS
GOOGLE_APPLICATION_CREDENTIALS  # optional Vision Web Detection
```

- Never commit `.env` or service-account JSON
- Use testnet-only private keys
- Rotate keys if exposed in chat, screenshots, or recordings

## API Security

- SerpAPI: key in query string over HTTPS; failures on all engines abort the pipeline
- Pinata: JWT for upload; prefer scoped tokens
- Google Vision (optional): service account with minimal Vision scope
- No scraping of authenticated/private social profiles

## Threat Model

| Threat | Mitigation |
|---|---|
| Hardcoded fake results | `npm run self-test` scans codebase |
| Tampered verification JSON | Canonical hash + on-chain commitment |
| IPFS content swap | Audit re-fetches and re-hashes IPFS content |
| Wrong-contract receipt | Audit checks `receipt.to === contract` + event from that address |
| Wrong RPC / chain | Anchor + audit assert Ethereum Sepolia `chainId` `11155111` |
| Replay / duplicate | Duplicate `recordHash` rejected by contract |

## Responsible Use

Do not use this pipeline for:

- Surveillance of non-consenting individuals
- Automated doxxing or identity attribution
- Production KYC without legal review and proper biometric governance
