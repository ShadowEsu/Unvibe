# Asset inventory

All assets live under `public/`. Brand marks are original; product screenshots come from
approved companion mockups (Jul 13 2026), cropped into light/dark halves.

## Brand — `public/brand/`

| File | Use |
|---|---|
| `logo.svg` | Hexagon U mark from the desktop app. |
| `icon.png` | App icon. |
| `icon-1024.png` | High-resolution app icon. |

The header/footer `Logo` component redraws the mark inline as SVG with `currentColor`.

## Social — `public/`

| File | Use |
|---|---|
| `og.png` | Open Graph / Twitter preview (1200×630). |

## Product screenshots — `public/unvibe/`

Each screen ships as `<name>-light.webp` and `<name>-dark.webp` (optimized for the web).

| Base name | Screen | Source |
|---|---|---|
| `progress` | Progress | Approved mockup |
| `projects` | Projects | Approved mockup |
| `study` | Study | Approved mockup |
| `notebook` | Notebook | Approved mockup |
| `library` | Library | Approved mockup |
| `settings` | Settings | Approved mockup |
| `profile` | Profile | Approved mockup |
| `help` | Help | Approved mockup |

### Rendered as HTML (no image)

| Item | Where | Why |
|---|---|---|
| Explanation overlay | `ProductGallery` + `HeroDemo` | No dedicated overlay screenshot; rebuilt as HTML/CSS. |
| Home companion | — | No separate Home export; Progress / Profile cover companion storytelling. |

## Notes

- Images preserve original aspect after left/right crop from side-by-side light/dark boards.
- `next/image` handles sizing and lazy loading.
- Do not use Wispr Flow, Clico, or Codecademy screenshots or proprietary UI in marketing.
