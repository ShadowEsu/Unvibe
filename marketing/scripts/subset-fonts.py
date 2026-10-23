"""Rebuild the two self-hosted first-paint fonts in src/app/fonts/.

Inter (body) and Bricolage Grotesque (headings) are the faces the first screen paints with, so their bytes
count toward LCP. Google's "latin" files carry glyphs the site never sets: OpenType alternates it doesn't
turn on, and combining marks, modifier letters and a few extra letters (ı, Œ, œ). This keeps every
Latin-1 character, the General Punctuation block, the arrows the copy uses, the euro, trademark and minus
signs, and only the OpenType features the CSS uses (kerning, ligatures, Inter's cv02/cv03/cv04/cv11 and
tabular figures). Both fonts stay variable (every weight) and keep their copyright and OFL name records.

Inputs are the Google Fonts latin woff2 files (the ones next/font/google downloads):
  uv run --with fonttools --with brotli scripts/subset-fonts.py <Inter latin woff2> <Bricolage latin woff2>
"""

import sys

from fontTools import subset
from fontTools.ttLib import TTFont

BASE_FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "rvrn"]
EXTRA = {0x2190, 0x2191, 0x2192, 0x2193, 0x20AC, 0x2122, 0x2212}


def keep(codepoint: int) -> bool:
    return codepoint < 0x100 or 0x2000 <= codepoint <= 0x206F or codepoint in EXTRA


def build(src: str, out: str, features: list[str]) -> None:
    font = TTFont(src)
    codepoints = [c for c in font.getBestCmap() if keep(c)]
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = features
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    build(sys.argv[1], "src/app/fonts/inter-latin-ui.woff2", BASE_FEATURES + ["cv02", "cv03", "cv04", "cv11", "tnum"])
    build(sys.argv[2], "src/app/fonts/bricolage-latin-ui.woff2", BASE_FEATURES)
