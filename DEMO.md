# Demo Guide — Screen Recording Script

## Prerequisites

1. Node 20–22 + `npm install`
2. **SerpAPI** key (primary reverse-image provider)
3. Pinata account + JWT
4. Ethereum Sepolia wallet with test ETH
5. Deployed `VerificationRegistry` contract (`npm run deploy`)
6. **`REQUIRE_SOCIAL_MATCH=true`** in `.env` (default)
7. Consenting subject with a **public social-media post** already indexed (post URL, not only a profile DP)
8. Optional: Google Vision credentials (secondary reverse-search only)

## Step 1: Prepare consenting subject image

```bash
# Live check that providers discover a SOCIAL_POST BEFORE full pipeline:
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
SERPAPI_KEY=
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
cd face-id-blockchain-verification
git log --oneline -5
# show REQUIRE_SOCIAL_MATCH default in .env.example
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
2. Face detected (local face-api)  
3. Face encoding hash  
4. Reverse-image search — **live SerpAPI call**  
5. Evidence selected — **SOCIAL_POST** classification shown  
6. Canonical commitment hash  
7. IPFS CID  
8. Ethereum Sepolia transaction confirmed  

Copy the explorer URL from output.

### Scene 4 — Open evidence (30 sec)

In browser (optional but compelling):

- Open the discovered social post URL  
- Open `https://sepolia.etherscan.io/tx/<tx_hash>`  
- Open `https://gateway.pinata.cloud/ipfs/<cid>`  

### Scene 5 — Independent audit (1 min)

```bash
npm run audit -- ./artifacts/verification.json --image ./samples/demo.jpg
```

Expect every section to pass (input hash, canonical JSON, IPFS, URL classification, chain, receipt → contract).

### Scene 6 — Tamper proof (optional, 30 sec)

Edit one field in `artifacts/verification.json`, re-run audit — expect **VERIFICATION FAILED**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `NO VERIFIED MATCH FOUND` | Post the photo publicly; wait for indexing; re-run compare-providers |
| SerpAPI all engines failed | Check `SERPAPI_KEY` / quota |
| Wrong chain | Ensure `RPC_URL` is Ethereum Sepolia (`11155111`), not Base |
| Transaction reverted | Fund wallet on Ethereum Sepolia |
| Face not detected | Use a clearer frontal face crop via `prepare-demo` |

See [LIMITATIONS.md](./LIMITATIONS.md) and [E2E_VALIDATION.md](./E2E_VALIDATION.md).
