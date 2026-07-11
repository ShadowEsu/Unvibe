# Design system — Uncode

Strict black / white / restrained grays. No gradients, no colored status, no AI glow, no
shadow-heavy cards, no clutter. Calm, minimal, premium, technical-but-approachable, highly
readable. Every surface handles loading / empty / error / offline. Keyboard-operable.

> Inspired only by the *low-friction, compact, non-interrupting* feel of small desktop
> utilities. No copied layout, spacing, icons, wording, motion, or navigation.

## Design tokens

### Color — light (default)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | surface background |
| `--bg-subtle` | `#F7F7F7` | secondary panels |
| `--fg` | `#0A0A0A` | primary text |
| `--fg-muted` | `#6B6B6B` | secondary text |
| `--fg-faint` | `#9A9A9A` | tertiary / hints |
| `--line` | `#E5E5E5` | borders / dividers |
| `--line-strong` | `#C9C9C9` | emphasized borders |
| `--fill-hover` | `#F0F0F0` | hover background |
| `--fill-active` | `#0A0A0A` | active/primary button bg |
| `--on-fill` | `#FFFFFF` | text on active fill |
| `--focus` | `#0A0A0A` | 2px focus ring |

### Color — dark (editor dark / prefers-color-scheme: dark)
| Token | Value |
|---|---|
| `--bg` | `#0B0B0B` |
| `--bg-subtle` | `#141414` |
| `--fg` | `#F2F2F2` |
| `--fg-muted` | `#A3A3A3` |
| `--fg-faint` | `#6E6E6E` |
| `--line` | `#242424` |
| `--line-strong` | `#3A3A3A` |
| `--fill-hover` | `#1C1C1C` |
| `--fill-active` | `#F2F2F2` |
| `--on-fill` | `#0B0B0B` |
| `--focus` | `#F2F2F2` |

Status is conveyed by **text + weight + iconography**, never hue. (One exception reserved:
a single warning treatment for privacy/secret blocks, rendered as bold text + rule, not color.)

### Typography
- UI: system stack — `-apple-system, "Segoe UI", Roboto, sans-serif`.
- Code: `"SF Mono", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace`.
- Scale: `--fs-11 11px` (meta), `--fs-12 12px` (secondary), `--fs-13 13px` (body),
  `--fs-15 15px` (title), `--fs-18 18px` (dashboard heading).
- Weights: 400 body, 500 emphasis, 600 headings. Line-height 1.5 body / 1.3 headings.

### Spacing (4px base)
`--s-1 4` · `--s-2 8` · `--s-3 12` · `--s-4 16` · `--s-5 24` · `--s-6 32` · `--s-7 48`.

### Borders / radii / shadows
- Border: `1px solid var(--line)`.
- Radii: `--r-0 0` · `--r-1 2px` · `--r-2 6px` (max — nothing rounder).
- Shadows: none by default. Elevation via a `1px` border only. One allowed soft shadow for
  the detached notification box: `0 2px 8px rgba(0,0,0,.12)`.

### Motion
- Durations: `--t-fast 120ms` · `--t-base 160ms`. Easing: `cubic-bezier(.2,0,.2,1)`.
- Only opacity/transform. No bouncing, no glow, no looping. Respect
  `prefers-reduced-motion: reduce` → disable transitions.

## Surfaces (16) — status
Full per-surface spec (purpose, dimensions, hierarchy, controls, empty/loading/error,
a11y, keyboard, motion) is authored per milestone. Milestone 1 implements the **review side
panel** shell (surface #4) and the **status-bar prompt** (part of #1/#3). Remaining surfaces
(#2 notification box, #5 selection state, #6 project summary, #7 comprehension, #8 achievement
card, #9–16 dashboard set) land with their milestones.

## Accessibility baseline
- All interactive elements reachable and operable by keyboard; visible 2px focus ring.
- Contrast ≥ WCAG AA against `--bg` (the mono palette is chosen to satisfy this).
- Honor `prefers-reduced-motion`. Screen-reader labels on icon-only controls.
