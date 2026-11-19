# The brand aurora (`companion/aurora.webp`, `widget/aurora.webp`)

The violet "bubbles" photo behind every window of the glass design (round 2, Design
`requests/unvibe-app/20261107-1939-design-r2-options-glass.md`). It is the website's hero background, byte for byte:
`marketing/public/d/bg/hero-bubbles-1440.webp` (1440 × 900, 17 828 bytes, sha256 prefix `085dd19e5903844b`), whose
provenance is `marketing/public/d/bg/PROVENANCE.md`.

- Source photo: "Bubbles on seawater (Unsplash mxPgL7cG QQ).jpg", Tim Marshall (Unsplash), **CC0**, via Wikimedia
  Commons. Recoloured (violet duotone) and blurred for the site; the app ships that file unchanged.
- Credit line (About): "Photo: Tim Marshall (Unsplash), CC0, recoloured".
- Two copies because `scripts/build.mjs` copies images per window directory; the file is small enough that one shared
  copy is not worth a build change.
