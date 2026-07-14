# Motion system

Motion on the Unvibe site is calm and purposeful. It clarifies structure and tells the
product story; it never decorates for its own sake. Only `opacity` and `transform`
animate, and everything degrades gracefully when a visitor prefers reduced motion.

The tokens live in `src/lib/motion.ts` and mirror the Tailwind `duration-*` and
`ease-*` utilities defined in `tailwind.config.ts`.

## Three tiers

| Tier | Range | Used for |
|---|---|---|
| micro | 120–180ms | hover, press, toggle, focus — feedback that must feel instant |
| standard | 250–450ms | entrances, layout shifts, tab and panel reveals |
| story | 700–1200ms | the hero demo choreography and scroll set pieces |

Easing:

- `calm` — `cubic-bezier(0.2, 0, 0.2, 1)` for most transitions.
- `emphatic` — `cubic-bezier(0.16, 1, 0.3, 1)` for entrances that should feel arrived.

## Patterns

- **Section entrances** use `fadeUp` + `stagger` via Framer Motion `whileInView`, played
  once (`inViewOnce`) so scrolling back up does not replay them.
- **The hero demo** (`HeroDemo.tsx`) is a single `requestAnimationFrame` timeline mapped
  onto elapsed time, looping every ~12.5s. It exposes a pause/play control, pauses when
  scrolled out of view (IntersectionObserver), and renders a complete static frame when
  reduced motion is set.
- **Scroll storytelling** (`HowItWorks.tsx`) reads `useScroll` progress over a tall track
  and maps it to a discrete step for a sticky visual. Without JS or with reduced motion,
  the steps simply stack and stay readable.
- **Shared-layout animation** (`WorksWhere.tsx`) uses a `layoutId` pill that slides
  between active tabs.

## Reduced motion

`globals.css` collapses all animation and transition durations to near-zero under
`prefers-reduced-motion: reduce`. Ambient loops (marquee, caret, hero demo) additionally
check the preference in JS and stop rather than merely running instantly. Marquees also
pause on hover and focus-within.

## Rules of thumb

- If a motion does not help the user understand something, remove it.
- Never block interaction behind an animation; content is usable immediately.
- Keep durations short enough that repeat visits never feel slow.
