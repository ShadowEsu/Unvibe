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

# Changelog, FAQ and Investors backgrounds: the Golden Gate Bridge, HAER CA-31 (unvibe-site, Fri 6 Nov; ledger 562)

Three photographs by Jet Lowe, 1984, for the Historic American Engineering Record (HAER CA-31), a National Park Service
programme, so US federal works in the **public domain**; held by the Library of Congress, hosted on Wikimedia Commons.
Licence re-checked through the Commons API (`prop=imageinfo&iiprop=extmetadata|sha1`) on 2026-11-07 ~04:50Z: each
returns LicenseShortName "Public domain", License "pd", UsageTerms "Public domain", Copyrighted "False",
AttributionRequired "false"; file pages carry `{{PD-USGov-NPS}}` / `{{PD-USGov-NPS-HAER|CA-31-30}}`. Each original
was downloaded in full and its sha1 equals the one Commons records.

| Page | Commons file | Original sha1 | Crop box (x0, y0, x1, y1) |
|---|---|---|---|
| /releases | https://commons.wikimedia.org/wiki/File:GENERAL_VIEW_OF_BRIDGE,_LOOKING_NORTH,_SHOWING_THE_%27BAY_SIDE%27_OF_THE_STRUCTURE_-_Golden_Gate_Bridge,_Spanning_mouth_of_San_Francisco_Bay,_San_Francisco,_San_Francisco_County,_HAER_CAL,38-SANFRA,140-2.tif (LoC https://www.loc.gov/pictures/item/ca1355.photos.016324p) | a82ece4a760e80b081bf4acdb07a3936248c5bbc | (300, 326, 4760, 2835) of 5186 × 3708 |
| /faq | https://commons.wikimedia.org/wiki/File:GENERAL_VIEW,_LOOKING_SOUTH_AT_DUSK,_SHOWING_THE_%27SEA_SIDE%27_OF_THE_BRIDGE_-_Golden_Gate_Bridge,_Spanning_mouth_of_San_Francisco_Bay,_San_Francisco,_San_Francisco_County,_CA_HAER_CAL,38-SANFRA,140-21.tif (LoC https://www.loc.gov/pictures/item/ca1355.photos.016343p) | 5d1029de94bf0adc22122cc68a270347e7723b8b | (341, 1300, 3709, 3195) of 4014 × 5057 |
| /investors | https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_view_from_top,_HAER_CA-31-30.jpg | 4351b1106cd81910176344d6f26943864afe0403 | (239, 187, 4524, 2597) |

**Treatment:** 8-bit greyscale; cropped ≥ 5 % inside the film frame on every edge (no film border, no handwritten
"HAER No." mark); contrast ×1.06; Lanczos to 2400 and 1200 wide; AVIF via avifenc 1.4.2, WebP via Pillow, the highest
quality under 220,000 B (2400) / 90,000 B (1200). No tint, no retouching (channel spread ≤ 0.03: pure grey).

**Credit lines (shown in the page's `dg__credit` chip at the end of the page):**
- /releases: "Golden Gate Bridge, looking north over Fort Point, 1984. Historic American Engineering Record, Library of Congress · public domain" (Security NIT 2215: the camera stood above the fort)
- /faq: "Golden Gate Bridge, looking south at dusk, 1984. Historic American Engineering Record, Library of Congress · public domain"
- /investors: "Golden Gate Bridge, from the south tower looking north, 1984. Historic American Engineering Record, Library of Congress · public domain"

| File (marketing/public/d/bg/) | Bytes | sha256 |
|---|---|---|
| changelog-ggb-1200.avif | 88181 | c5f8ce274e51478fca043e78e610c7218dcbb3e5d0ec71acb9332dda585d2737 |
| changelog-ggb-1200.webp | 86756 | 47868512adbb0d103f4e1e844ee0c2a2008a43364d675956bb11b8f375bebc19 |
| changelog-ggb-2400.avif | 219750 | 80709060ff0c5d78023bec5f3645333b78cb79583cc61e554414e12c12a2e920 |
| changelog-ggb-2400.webp | 216224 | a34acfc6c57061b0e36a802eff1804677ed6ee8c064e38f89562abf52027923f |
| faq-ggb-1200.avif | 89122 | 42377eff97218080e5f55e55db661c92bf85f61082ed1171dfe5289187a13ea9 |
| faq-ggb-1200.webp | 82548 | cf9adad11feb05499450eabfd94d547be294d557878b5b8925178ad19e5f1377 |
| faq-ggb-2400.avif | 212467 | 66dcbf424a6789bfec10868333321581ec77a96418e774e9e26d25ef0cbf0124 |
| faq-ggb-2400.webp | 202678 | 1c905f4d1ee475be53c85c0320a6f94d3b6f82feed7a628cb14538d0db8d2c6b |
| investors-ggb-1200.avif | 86282 | 719b21220172d2bd79098e1fa819021a4a1209e2a864979801562edb95597de8 |
| investors-ggb-1200.webp | 88148 | 34e23c12e164a39ff42bdc39a6bd9ba11d69f2e073a9518eb3a93e1f1c91e741 |
| investors-ggb-2400.avif | 219196 | 24c0c82d40fb25a52cffa24f9bd1d13d57fee057370752c2c38716f6d886701c |
| investors-ggb-2400.webp | 219490 | 370e79dc0f80a6544bd2471f7af91a73d8ac215255d962e3115947d99bcf186a |
