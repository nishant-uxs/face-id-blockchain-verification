# Known Limitations

## Reverse Image Search

1. **Index coverage** — Google Vision Web Detection only finds images/pages in Google's crawled index. Private, recent, or unindexed social posts may not appear.
2. **Not identity proof** — A matching page proves visual similarity / image provenance, not that a face "belongs to" a named person.
3. **Social post vs profile** — Domain validation identifies social platforms but cannot always distinguish a post URL from a profile or CDN mirror.
4. **Visually similar ≠ exact match** — The pipeline explicitly rejects visually-similar-only results as evidence.

## Face Processing

1. **Detection provider** — Uses Google Cloud Vision FACE_DETECTION (requires GCP credentials).
2. **Not biometric ID** — Face encoding is a deterministic hash of landmarks/bbox metadata, not a recognition database lookup.
3. **Multiple faces** — Defaults to largest face; use `FACE_SELECTION=first` to change strategy.

## Blockchain

1. **Testnet only** — Base Sepolia records are for demonstration; not permanent mainnet proofs.
2. **Gas required** — Submitter wallet needs Sepolia ETH.
3. **Duplicate records** — Same commitment hash cannot be anchored twice (by design).

## Infrastructure

1. **API costs** — Google Vision and Pinata may incur usage charges beyond free tiers.
2. **Rate limits** — Public RPC endpoints may throttle; use a dedicated RPC for production demos.
3. **IPFS availability** — Gateway fetch depends on Pinata pinning and public gateway uptime.

## Demo Reliability

The demo image must be a **cropped variant** of a photo that already exists in Google's web index. Random internet photos often fail reverse-image search.

See [DEMO.md](./DEMO.md) for the recommended preparation workflow.
