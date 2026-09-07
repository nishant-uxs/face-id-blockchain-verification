# Demo Images

## ⚠️ Do NOT use Wikimedia for final submission

`samples/source.jpg` is a **development-only** public domain portrait. It will NOT satisfy `REQUIRE_SOCIAL_MATCH=true` because Wikimedia is not a social-media post.

## Required for submission demo

1. **Consenting participant** posts their photo on a public social platform (X, Instagram, LinkedIn, etc.)
2. Wait for the post to be indexed (may take hours)
3. Create a **derived** local copy:
   ```bash
   npm run prepare-demo -- ./path/to/original.jpg ./samples/demo.jpg
   ```
4. The derived image must be cropped/resized — **not** the exact downloaded social file
5. Run verification — the provider must **discover** the social post URL at runtime

## Verify provider finds your post first

```bash
npm run compare-providers -- ./samples/demo.jpg
```

At least one configured provider must return a `SOCIAL_POST` URL before running the full pipeline (SerpAPI alone is enough).

## Recording

See [DEMO.md](../DEMO.md) for the exact screen recording script.
