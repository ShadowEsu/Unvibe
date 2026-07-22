# Vibe Island ambient light — research & Unvibe adaptation

> Reference study only. Unvibe ships an **original** effect: no Vibe Island code,
> shaders, exact color values, assets, or composition are copied. The Vibe Island
> page is used the way you'd study a film's lighting — to understand the *technique*,
> then art-direct our own.

## Method / limitations

Live capture of `vibeisland.com` was **not possible from the build environment**
(outbound network to that host is blocked — `net::ERR_TUNNEL_CONNECTION_FAILED`,
and a plain fetch returns `403`). So this document is built from:

- the effect labels surfaced in the brief — **God-ray**, **Dithered**,
  **MacBook Mask Fade**, **Grain**, **Noise** — which strongly imply a *layered*
  composite rather than one animated gradient;
- established web technique for premium product-hero lighting;
- what we can control cheaply and cross-browser without WebGL.

**Follow-up when a networked machine is available:** open the hero in Chrome, record
~45s of the loop, and screenshot at 0s / 10s / 20s / 30s to confirm the movement
period and light direction, then reconcile any deltas here. This does not block the
Unvibe implementation — our effect is art-directed independently.

## Observed / inferred layers (top → bottom)

| Layer | Vibe Island label (inferred) | Purpose |
|-------|------------------------------|---------|
| Grain / Dither | `Grain`, `Dithered`, `Noise` | kills gradient banding; adds a filmic "made with care" texture |
| God rays | `God-ray` | 2–4 soft diagonal beams, heavy blur, long fades |
| Caustic reflections | (distortion layer) | broad, warped underwater light bands, very low opacity |
| Product mask fade | `MacBook Mask Fade` | lets light bleed *around/behind* the device; brightens the device region; fades the device into the scene |
| Base atmosphere | (background) | radial glow, brighter center, dark vignette edges |

The takeaway from the label set: the atmosphere is a **stack of subtle passes**,
each individually near-invisible, that only reads as "premium" in composite. That is
the principle we copy — not the pixels.

## Movement characteristics (target for Unvibe)

- **Full cycle:** 20–45s. We use ~30–40s per layer, with layers on *different,
  non-integer-multiple* periods so the composite never visibly "loops."
- **Light translation:** very small (a few % of viewport), plus slow scale/rotate.
- **Distortion:** gradual bend via SVG turbulence, not a marching pattern.
- **Direction:** primary rays fall top-left → bottom-right (Apple-ish key light).
- **Opacity:** restrained; nothing pulses hard.

## Masking & fading

- Lighting **fades at page edges** (vignette + radial mask).
- It **quiets behind body copy** and **brightens behind the product mockup**.
- It must **never** sit bright underneath nav, pricing, or paragraph text.
- It **transitions** from the cinematic hero into a calmer next section rather than
  tiling identically down the page.

## Performance risks & mitigations

| Risk | Mitigation |
|------|-----------|
| SVG `feDisplacementMap` is GPU-heavy at large sizes | apply to one modest layer only; drop it on mobile & reduced-transparency |
| Animating high-res noise every frame | grain is a **static** SVG turbulence texture, not re-rendered per frame |
| Continuous React re-render for animation | animation is **pure CSS**; JS only toggles a `paused` class |
| Battery / offscreen waste | pause on `document.hidden` and when the hero leaves the viewport (IntersectionObserver) |
| Banding on wide gradients | grain/dither overlay |
| Layout shift | the field is `position:absolute; inset:0` behind content; reserves no layout |

## Chosen Unvibe stack: **CSS + SVG filters (no WebGL)**

Rationale (the brief asks for "the simplest implementation that produces premium
results without unnecessary GPU usage"):

- **CSS** radial/linear gradients + `filter: blur()` + compositor-friendly
  `transform`/`opacity` keyframes for the atmosphere, bands, and rays.
- **SVG** `feTurbulence` for a static grain texture, and a single small
  `feTurbulence + feDisplacementMap` for the caustic bend (desktop only).
- **No WebGL / no canvas render loop** — nothing to leak, easy Safari/Firefox parity,
  trivial static fallback.

WebGL/canvas were rejected: higher battery cost, more failure modes, and no visible
quality gain at this opacity level.

## Original Unvibe palette (NOT Vibe Island's values)

```
--al-navy:    #0b0a14   near-black navy base
--al-indigo:  #171334   deep indigo
--al-violet:  #2a2150   muted violet
--al-purple:  #7c5cff   soft electric purple  (Unvibe's identity accent)
--al-blue:    #3b6ad6   cool blue
--al-lavender:#a78bfa   lavender highlight
--al-amber:   #d9a066   restrained warm amber (used sparingly, CTA-side only)
```

Purple stays Unvibe's signature, but the base is mostly navy/indigo so nothing looks
like a saturated purple dashboard.

## Section-by-section lighting plan

| Section | Treatment |
|---------|-----------|
| Hero | full system — most visible & cinematic |
| Product demo | focused glow behind the live Unvibe island / video |
| Features | quieter, smaller light movement |
| How it works | one slow ray connecting the stages |
| Changelog | subtle horizon reflection |
| Final CTA | brighter, slightly warmer (amber creeps in) |

The `AmbientLightField` component takes an `intensity`/`variant` prop so each section
dials the same system up or down instead of re-implementing it.

## Component API (implemented)

`web/src/components/AmbientLightField.tsx`

```tsx
<AmbientLightField variant="hero" />      // full cinematic
<AmbientLightField variant="section" />   // quieter reuse
```

Props: `variant` ('hero' | 'section' | 'cta'), optional `className`.
Behavior baked in: reduced-motion → static, reduced-transparency → less blur,
touch → no parallax, offscreen/hidden → paused, mobile → fewer layers + no displacement.
Dev debug panel: append `?ambientDebug=1` to the URL (dev only; toggles each layer).

## Accessibility & fallback checklist

- [x] `prefers-reduced-motion: reduce` → all animation off, static composite remains
- [x] `prefers-reduced-transparency: reduce` → blur/opacity reduced
- [x] pauses on tab hidden (`visibilitychange`) and offscreen (IntersectionObserver)
- [x] no per-frame React state; compositor-only transforms/opacity
- [x] text contrast preserved (light sits behind a readability scrim)
- [x] static fallback when JS is off (CSS renders; JS only pauses)
- [x] does not delay interactivity (no blocking work, no layout shift)

## Not yet verified in this environment (needs a real browser/machine)

- Safari & Firefox visual parity
- Lighthouse / runtime GPU profiling on a real MacBook
- The 45s screen recording of a full movement cycle
- Live reconciliation against the actual Vibe Island hero (network-blocked here)
