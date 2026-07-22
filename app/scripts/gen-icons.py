#!/usr/bin/env python3
"""
Generate Unvibe's icon assets with no third-party dependencies (stdlib zlib only).

Outputs into build/:
  - icon.png            1024x1024 app / Dock icon (deep near-black squircle + purple "U")
  - trayTemplate.png    22x22  menu-bar template (black + alpha, macOS recolors it)
  - trayTemplate@2x.png 44x44  retina menu-bar template
  - icon.icns           multi-resolution bundle for electron-builder / the packaged Dock icon

The "U" glyph is rendered from a signed-distance field so edges stay crisp at every
size, including the tiny menu-bar variants. Re-run after changing the palette:

    python3 scripts/gen-icons.py

Design language (docs/design-system.md): near-black surface, restrained purple accent,
soft rounded geometry, no gradients-as-decoration.
"""
import math
import struct
import zlib
from pathlib import Path

BUILD = Path(__file__).resolve().parent.parent / "build"

# --- palette -------------------------------------------------------------
SURFACE_TOP = (0x16, 0x16, 0x20)   # subtle lift at the top for depth
SURFACE_BOT = (0x0B, 0x0B, 0x0F)   # deep near-black base
PURPLE = (0x9B, 0x87, 0xF5)        # Unvibe accent


# --- tiny SDF renderer ---------------------------------------------------
def _clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def _smoothstep(edge0, edge1, x):
    t = _clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _seg_dist(px, py, ax, ay, bx, by):
    """Distance from point to segment a->b."""
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    denom = vx * vx + vy * vy
    t = 0.0 if denom == 0 else _clamp((wx * vx + wy * vy) / denom, 0.0, 1.0)
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return math.hypot(dx, dy)


def _u_distance(x, y):
    """Signed-ish distance to the centreline of a 'U' path, in [-1,1] square coords."""
    gw = 0.42          # half-width between the two arms
    ty = -0.52         # top of the arms
    by = 0.24          # centre of the bottom arc (radius == gw)
    d = min(
        _seg_dist(x, y, -gw, ty, -gw, by),
        _seg_dist(x, y, gw, ty, gw, by),
    )
    if y >= by:
        d = min(d, abs(math.hypot(x, y - by) - gw))
    return d


def _round_rect_sd(x, y, half, radius):
    """Signed distance to a rounded square centred at origin (negative == inside)."""
    qx = abs(x) - (half - radius)
    qy = abs(y) - (half - radius)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - radius


def _render_app(size, ss=4):
    """1024-style app icon: squircle surface with a purple U."""
    W = size * ss
    buf = bytearray(4 * W * W)
    half = 0.82          # square half-extent (leaves macOS padding)
    radius = 0.42        # generous corner rounding
    stroke = 0.155       # U stroke half-thickness
    aa = 1.6 / (W / 2)   # ~1.6px anti-alias band in normalised units
    for j in range(W):
        ny = (j + 0.5) / W * 2 - 1
        for i in range(W):
            nx = (i + 0.5) / W * 2 - 1
            sq = _round_rect_sd(nx, ny, half, radius)
            sq_cov = _smoothstep(aa, -aa, sq)
            if sq_cov <= 0.0:
                continue
            # vertical gradient across the surface
            g = _clamp((ny + half) / (2 * half), 0.0, 1.0)
            r = round(SURFACE_TOP[0] * (1 - g) + SURFACE_BOT[0] * g)
            gg = round(SURFACE_TOP[1] * (1 - g) + SURFACE_BOT[1] * g)
            b = round(SURFACE_TOP[2] * (1 - g) + SURFACE_BOT[2] * g)
            # purple U on top
            du = _u_distance(nx, ny)
            u_cov = _smoothstep(stroke + aa, stroke - aa, du)
            if u_cov > 0.0:
                r = round(r * (1 - u_cov) + PURPLE[0] * u_cov)
                gg = round(gg * (1 - u_cov) + PURPLE[1] * u_cov)
                b = round(b * (1 - u_cov) + PURPLE[2] * u_cov)
            a = round(255 * sq_cov)
            o = 4 * (j * W + i)
            buf[o], buf[o + 1], buf[o + 2], buf[o + 3] = r, gg, b, a
    return _downsample(buf, W, ss), size


def _render_tray(size, ss=4):
    """Menu-bar template: transparent bg, black U in the alpha channel."""
    W = size * ss
    buf = bytearray(4 * W * W)
    stroke = 0.19        # bolder so it reads at 22px
    scale = 0.86         # fill most of the menu-bar slot
    aa = 1.4 / (W / 2)
    for j in range(W):
        ny = ((j + 0.5) / W * 2 - 1) / scale
        for i in range(W):
            nx = ((i + 0.5) / W * 2 - 1) / scale
            du = _u_distance(nx, ny)
            cov = _smoothstep(stroke + aa, stroke - aa, du)
            if cov <= 0.0:
                continue
            o = 4 * (j * W + i)
            buf[o] = buf[o + 1] = buf[o + 2] = 0  # black; macOS tints template images
            buf[o + 3] = round(255 * cov)
    return _downsample(buf, W, ss), size


def _downsample(buf, W, ss):
    if ss == 1:
        return buf
    out_w = W // ss
    out = bytearray(4 * out_w * out_w)
    inv = 1.0 / (ss * ss)
    for j in range(out_w):
        for i in range(out_w):
            r = g = b = a = 0
            for dj in range(ss):
                row = ((j * ss + dj) * W + i * ss) * 4
                for di in range(ss):
                    p = row + di * 4
                    r += buf[p]; g += buf[p + 1]; b += buf[p + 2]; a += buf[p + 3]
            o = 4 * (j * out_w + i)
            out[o] = round(r * inv)
            out[o + 1] = round(g * inv)
            out[o + 2] = round(b * inv)
            out[o + 3] = round(a * inv)
    return out


# --- PNG encode ----------------------------------------------------------
def _png(buf, size):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)  # filter: none
        raw.extend(buf[y * stride:(y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b""))


# --- ICNS bundle ---------------------------------------------------------
# OSTypes that take PNG data (16..1024, incl. retina variants).
ICNS_TYPES = {
    16: b"icp4", 32: b"icp5", 64: b"icp6",
    128: b"ic07", 256: b"ic08", 512: b"ic09", 1024: b"ic10",
}
ICNS_RETINA = {32: b"ic11", 64: b"ic12", 256: b"ic13", 512: b"ic14"}


def _icns(pngs):
    body = bytearray()
    for size, tag in ICNS_TYPES.items():
        data = pngs[size]
        body += tag + struct.pack(">I", len(data) + 8) + data
    for size, tag in ICNS_RETINA.items():
        data = pngs[size]
        body += tag + struct.pack(">I", len(data) + 8) + data
    return b"icns" + struct.pack(">I", len(body) + 8) + bytes(body)


def main():
    BUILD.mkdir(parents=True, exist_ok=True)

    app1024, _ = _render_app(1024)
    (BUILD / "icon.png").write_bytes(_png(app1024, 1024))

    tray22, _ = _render_tray(22)
    tray44, _ = _render_tray(44)
    (BUILD / "trayTemplate.png").write_bytes(_png(tray22, 22))
    (BUILD / "trayTemplate@2x.png").write_bytes(_png(tray44, 44))

    pngs = {}
    for size in (16, 32, 64, 128, 256, 512, 1024):
        buf, _ = _render_app(size, ss=4 if size <= 256 else 2)
        pngs[size] = _png(buf, size)
    (BUILD / "icon.icns").write_bytes(_icns(pngs))

    for f in ("icon.png", "trayTemplate.png", "trayTemplate@2x.png", "icon.icns"):
        p = BUILD / f
        print(f"  {f:22} {p.stat().st_size:>8} bytes")
    print("icons ok")


if __name__ == "__main__":
    main()
