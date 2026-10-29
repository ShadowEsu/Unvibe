# Asset inventory

All assets live under `public/`. Brand marks are original; product screenshots come from
approved companion mockups (Jul 13 2026), cropped into light/dark halves.

## Brand — `public/brand/`

| File | Use |
|---|---|
| `logo.svg` | Hexagon U mark — brand purple `#6f45d2` with baked 45° shadow. |
| `icon.png` | App / tab icon (same mark). |
| `icon-1024.png` | High-resolution app icon. |
| `/favicon.ico`, `/apple-touch-icon.png` | Browser tab + home-screen icons (generated from the mark). |

The header/footer `Logo` component redraws the mark inline as SVG with `currentColor`.

## Social — `public/`

| File | Use |
|---|---|
| `og/og-<key>-<hash>.png` | Link-preview cards (1200×630), one per page group; `src/lib/pageMeta.ts` maps pages to cards. |

## Product screenshots — `public/unvibe/`

`public/unvibe/real/*.webp` are the real app screenshots the homepage walkthrough uses; `scripts/build-demo-media.mjs` writes them from an `app/e2e/marketing-media.mjs` capture.

The July `<name>-light.webp` / `<name>-dark.webp` mockups (Progress, Projects, Study, Notebook, Library, Settings, Profile, Help) were removed on 2026-10-22: they showed the capture account's name, no page rendered them, and most of those screens no longer exist. `OpeningStrip` still points at them but is not imported anywhere.

### Rendered as HTML (no image)

| Item | Where | Why |
|---|---|---|
| Explanation overlay | `HeroDemo` | No dedicated overlay screenshot; rebuilt as HTML/CSS. |
| Home companion | — | No separate Home export; Progress / Profile cover companion storytelling. |

## Notes

- Images preserve original aspect after left/right crop from side-by-side light/dark boards.
- `next/image` handles sizing and lazy loading.
- Do not use Wispr Flow, Clico, or Codecademy screenshots or proprietary UI in marketing.
