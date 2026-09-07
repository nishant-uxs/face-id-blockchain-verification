# Architecture

## Overview

**Face ID + Blockchain Verification** is a CLI-first pipeline that produces tamper-evident provenance records for consenting demo subjects (HH Goa 2026 Task #3).

```mermaid
flowchart TD
    A[Input Image] --> B[Validate MIME/Size]
    B --> C[Local face-api Face Detection]
    C --> D[Crop + Normalize Face]
    D --> E[Deterministic Descriptor Hash]
    E --> F[Reverse Image Search]
    F --> G{Qualifying SOCIAL_POST?}
    G -->|No| H[NO VERIFIED MATCH FOUND]
    G -->|Yes| I[Evidence Scoring]
    I --> J[Canonical JSON Commitment]
    J --> K[IPFS Upload via Pinata]
    K --> L[Ethereum Sepolia Anchor]
    L --> M[verification.json + CLI Report]

    M --> N[audit command]
    N --> O[Re-hash JSON]
    N --> P[Fetch IPFS]
    N --> Q[Read Chain Record]
    N --> R[Verify Tx Receipt → Contract]
    O --> S{All checks pass?}
    P --> S
    Q --> S
    R --> S
    S -->|Yes| T[VERIFICATION VALID]
    S -->|No| U[VERIFICATION FAILED]
```

## Module Layout

```
src/
  cli/            Commander entry + HH Goa branded terminal UI
  pipeline/       Orchestrates the 8-step verify flow
  face/           Local @vladmandic/face-api detection + crop + descriptor hash
  reverse-search/ Provider abstraction (SerpAPI Lens primary, Vision optional)
  evidence/       Scoring, URL classification, canonical record builder
  hashing/        SHA-256 + deterministic key-sorted JSON
  ipfs/           Pinata upload + gateway fetch
  blockchain/     viem client, VerificationRegistry interaction
  audit/          Independent re-verification
  config/         Brand tokens, env loading + validation
  utils/          Image I/O, URL helpers, errors
```

## Commitment Model

The on-chain `recordHash` commits to the **committable payload** — everything except `integrity`, `storage`, and `blockchain` metadata:

- Input image metadata (SHA-256, dimensions)
- Face detection results (bbox, confidence, encoding hash)
- Full reverse-image search response (runtime-fetched)
- Selected evidence + transparent score breakdown

IPFS stores the committable JSON. The chain stores `recordHash` + `ipfsCid` + timestamp.

```mermaid
flowchart LR
    JSON[Committable JSON] -->|key-sorted SHA-256| H[recordHash]
    JSON -->|Pinata| C[ipfsCid]
    H --> R[VerificationRegistry]
    C --> R
```

## Provider Abstraction

```mermaid
flowchart TB
    P[ReverseImageProvider]
    P --> S[SerpApiLensProvider — primary]
    P --> G[GoogleVisionWebDetectionProvider — optional]
    S --> L1[google_lens]
    S --> L2[google_lens exact_matches]
    S --> L3[google_reverse_image]
```

Normalized output shape enables provider swapping without changing the evidence layer.

## Why No Website

Per official Task #3 requirements, judges evaluate the pipeline itself — not a hosted UI.
