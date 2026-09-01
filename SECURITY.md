# Security & Privacy

## Privacy Boundary

This system is designed for **consenting demo subjects** only.

- We do **not** attempt to identify unknown persons
- We do **not** treat a matched name as proof of identity
- The claim is: **"Evidence found for a matching image/page"**

## Data Stored

### On IPFS (public)

- Input image metadata (filename, SHA-256, dimensions) — **not the raw image**
- Face bounding box + confidence + encoding hash — **not raw embeddings**
- Full reverse-image search API response
- Selected evidence URLs and score breakdown

### On-chain (public)

- `recordHash` (SHA-256 of committable JSON)
- `ipfsCid`
- `timestamp`
- `submitter` address

### Never stored on-chain

- Raw face embeddings
- Biometric templates
- API keys or secrets

## Secrets Management

All secrets via environment variables:

```
GOOGLE_APPLICATION_CREDENTIALS
PINATA_JWT
PRIVATE_KEY
SERPAPI_KEY (optional)
```

- Never commit `.env`
- Use testnet-only private keys
- Rotate keys if exposed

## API Security

- Google Vision: service account with minimal Vision API scope
- Pinata: JWT scoped to file upload only
- No scraping of authenticated/private social profiles

## Threat Model

| Threat | Mitigation |
|---|---|
| Hardcoded fake results | `npm run self-test` scans codebase |
| Tampered verification JSON | Canonical hash + on-chain commitment |
| IPFS content swap | Audit re-fetches and re-hashes IPFS content |
| Replay attack | Duplicate recordHash rejected by contract |

## Responsible Use

Do not use this pipeline for:
- Surveillance of non-consenting individuals
- Automated doxxing or identity attribution
- Production KYC without legal review and proper biometric governance
