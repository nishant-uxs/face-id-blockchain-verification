# Demo Guide — Screen Recording Script

## Prerequisites

1. GCP project with **Cloud Vision API** enabled
2. Service account JSON with Vision API access
3. Pinata account + JWT
4. Base Sepolia wallet with test ETH
5. Deployed `VerificationRegistry` contract
6. **`REQUIRE_SOCIAL_MATCH=true`** in `.env` (default)
7. Consenting subject with a **public social-media post** already indexed

## Step 1: Prepare consenting subject image

The demo subject must **consent** and have posted their photo publicly (X, Instagram, LinkedIn).

```bash
# Verify providers find the social post BEFORE full pipeline:
npm run compare-providers -- ./samples/demo.jpg

# Create derived local copy (crop/resize — NOT the exact downloaded file):
npm run prepare-demo -- ./path/to/original.jpg ./samples/demo.jpg
```

## Step 2: Configure environment

```bash
cp .env.example .env
# Edit .env — see README for all variables
```

Required:
```
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
PINATA_JWT=
PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
REQUIRE_SOCIAL_MATCH=true
```

## Step 3: Deploy contract (first time only)

```bash
npm run deploy
# Copy CONTRACT_ADDRESS into .env
```

---

## Screen Recording Script (ONE continuous take)

Open a fresh terminal. Record the entire session with no cuts.

### Scene 1 — Repository context (15 sec)

```bash
cd hacker-house-goa-task3
git log --oneline -5
cat .env.example | grep REQUIRE_SOCIAL_MATCH
```

Say: *"REQUIRE_SOCIAL_MATCH is true — only genuine social posts qualify."*

### Scene 2 — Provider check (optional, 30 sec)

```bash
npm run compare-providers -- ./samples/demo.jpg
```

Point out a discovered `SOCIAL_POST` URL from live API output.

### Scene 3 — Full verification (2–3 min)

```bash
npm run verify -- ./samples/demo.jpg
```

Watch for all 8 stages:
1. Image loaded + SHA-256
2. Face detected (Google Vision API)
3. Face encoding hash
4. Reverse-image search — **live API call**
5. Evidence selected — **SOCIAL_POST** classification shown
6. Canonical commitment hash
7. IPFS CID
8. Base Sepolia transaction confirmed

Copy the explorer URL from output.

### Scene 4 — Open evidence (30 sec)

In browser (optional but compelling):
- Open the discovered social post URL
- Open `https://sepolia.basescan.org/tx/<tx_hash>`
- Open `https://gateway.pinata.cloud/ipfs/<cid>`

### Scene 5 — Independent audit (1 min)

```bash
npm run audit -- ./artifacts/verification.json --image ./samples/demo.jpg
```

Expected final screen:

```
╭────────────────────────────────────────╮
│       ✓ VERIFICATION VALID              │
│  Evidence integrity confirmed on-chain │
╰────────────────────────────────────────╯
```

### Scene 6 — Tamper proof (optional, 1 min)

```bash
# Modify artifact (change one field), then audit — should FAIL
# Restore original, audit again — should PASS
```

---

## What judges should see

| Signal | Evidence |
|---|---|
| Genuine reverse search | API provider name + live match counts in terminal |
| Not hardcoded | URL discovered at runtime, varies per image |
| Social post | `classification: SOCIAL_POST` in output |
| Real blockchain | Basescan tx link opens to real transaction |
| Real IPFS | CID resolves to verification JSON |
| Tamper-evident | Audit fails on modified artifact |

## Troubleshooting

| Issue | Solution |
|---|---|
| NO VERIFIED MATCH FOUND | Post must be indexed; try `compare-providers` first |
| Only Wikimedia results | Wrong image — use consenting subject's social post |
| Profile URL only | Not a post — need `/status/`, `/p/`, etc. |
| Missing credentials | Check `.env` |
| Transaction reverted | Fund wallet on Base Sepolia |
| Already recorded | Use new image or new verification |

## Do NOT use for submission

- Wikimedia / Wikipedia images
- `REQUIRE_SOCIAL_MATCH=false`
- Pre-recorded or edited terminal output
- Hardcoded expected URLs
