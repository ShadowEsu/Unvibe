# D hero background "purple water bubbles" (Motion, Fri 6 Nov)

**Source (one photo, nothing else):** "Bubbles on seawater (Unsplash mxPgL7cG QQ).jpg", Tim Marshall (Unsplash), **CC0**,
via Wikimedia Commons.

- Commons: https://commons.wikimedia.org/wiki/File:Bubbles_on_seawater_(Unsplash_mxPgL7cG_QQ).jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/b/b8/Bubbles_on_seawater_%28Unsplash_mxPgL7cG_QQ%29.jpg
- Unsplash page (per Commons): https://unsplash.com/photos/mxPgL7cG_QQ
- Downloaded file sha1 `81ea28f4ab0c51ce4b636f8a0d47e440cf539928` (equals Commons' recorded sha1), 5184 × 3456.

The Pinterest reference image is not used in any way (look only).

**Treatment (`dapple.py`, soft = 20):** the photo's bubble band (two crops of its top quarter) is enlarged and tiled
across a 2880 × 1800 frame with a lighten composite, blurred (σ 20 and σ 120 at 2880), gradient-mapped to Unvibe's
violets (#2E1A78 → #5537C4 → #866AEC → #CFC0FF → #F7F3FF), calmed in the top 25 % behind the headline, and given a
22 % violet-black radial scrim there (Design's allowance). Nothing recognisable of the photo survives; it reads as
soft dappled violet light.

**Files (marketing/public/d/bg/):**

| File | Bytes | sha256 (16) | Use |
|---|---|---|---|
| hero-bubbles-1440.avif | 6039 | 0596732e6e6b7684 | ≥ 600 px wide (every DPR: the image is a blur) |
| hero-bubbles-390.avif | 1927 | ed004d1a575d66c0 | < 600 px (the portrait centre crop) |
| hero-bubbles-1440.webp | 17828 | 085dd19e5903844b | fallback |
| hero-bubbles-390.webp | 5618 | daaa15b832217bf6 | fallback |

**LCP:** both AVIFs sit under Chrome's low-entropy threshold (0.05 bits per displayed pixel): 0.037 at 1440 × 900,
0.047 at 390 × 844, so Chrome never counts them as the LCP; the H1 stays the LCP. (Below ~1280 × 800 desktop the
1440 file crosses 0.05: measure there.) Never preload them.

**Contrast:** white type over the headline box (1440: x 410-1030, y 112-160): worst 2 % 6.07:1, median 6.74:1.

**Credit line (mono, footer):** "PHOTO: TIM MARSHALL (UNSPLASH), CC0, RECOLOURED".
