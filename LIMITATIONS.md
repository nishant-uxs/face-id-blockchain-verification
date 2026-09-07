# Known Limitations

## Reverse Image Search

1. **Index coverage** — SerpAPI / Google Lens only find images/pages already indexed. Private, very recent, or unindexed posts may not appear.
2. **Not identity proof** — A matching page proves visual / URL provenance, not that a face “belongs to” a named person.
3. **Social post vs profile** — The URL classifier distinguishes post-like paths from profiles/CDNs, but edge-case URLs can still be ambiguous.
4. **Visually similar ≠ exact match** — The pipeline explicitly rejects visually-similar-only results as evidence.
5. **Organic Lens hits** — Kept as matching pages only when stronger exact/partial signals already exist.

## Face Processing

1. **Detection provider** — Local `@vladmandic/face-api` (SSD MobileNet) + canvas; no GCP billing required for face detect.
2. **Not biometric ID** — Stored value is a deterministic hash of a quantized 128-D descriptor, not a recognition DB lookup.
3. **Multiple faces** — Defaults to largest face; use `FACE_SELECTION=first` to change strategy.
4. **Query image hosting** — Face crop is temporarily published on IPFS so Lens can fetch a public URL.

## Blockchain

1. **Testnet only** — Ethereum Sepolia records are for demonstration; not permanent mainnet proofs.
2. **Gas required** — Submitter wallet needs Sepolia ETH.
3. **Duplicate records** — Same commitment hash cannot be anchored twice (by design).
4. **Open registry** — Anyone with the ABI can call `recordVerification` for new hashes (spam possible; duplicates rejected).

## Infrastructure

1. **API costs** — SerpAPI, Pinata, and optional Vision may incur usage beyond free tiers.
2. **Rate limits** — Public RPC endpoints may throttle; prefer Alchemy/Infura for demos.
3. **IPFS availability** — Gateway fetch depends on Pinata pinning and public gateway uptime.

## Demo Reliability

The demo photo must already exist as a **public social post** that reverse-image engines can index. A LinkedIn DP alone is often **not** enough — publish a **post**, wait for indexing, then re-run.

See [DEMO.md](./DEMO.md) for the recommended preparation workflow.
