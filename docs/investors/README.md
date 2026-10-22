# Investor materials

Canonical Unvibe investor materials for sharing. The deck is no longer published on unvibe.site
(taken offline 2026-10-22: it disclosed AWS Activate credits, which AWS Activate terms forbid).
`marketing/scripts/build-deck.mjs` still writes into `marketing/public/investors/`; running it would
publish the deck again, so do not commit its output. Older slide renders and inspect dumps lived
under `output/pdf` / `tmp/pdfs` and were removed.

| File | What it is |
|---|---|
| `Unvibe_Pitch_Deck.pdf` | **Canonical 14-slide investor deck** |
| `Unvibe-Full-Investor-One-Pager.pdf` | Full investor one-pager |
| `Unvibe-Investor-Deck.pdf` | Compatibility copy of the canonical investor deck |
| `Unvibe-Investor-and-Funding-Brief.pdf` | Funding brief (3 pages) |
| `Unvibe-Pitch-Deck.pdf` | Compatibility copy of the canonical investor deck |
| `Unvibe-Website-Pitch-Deck.pdf` | Compatibility copy of the canonical investor deck |
| `.pptx` files | Historical editable source decks; do not present as the current deck |

Regenerate from source scripts only if you intentionally rebuild these; do not commit
intermediate PNG renders or `.inspect.ndjson` files.
