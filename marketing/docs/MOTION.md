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

## Shared tokens and the site's moments

The fleet-wide `--m-*` tokens (Design motion spec, 4 Nov 2026, §1) sit in `globals.css`
next to the older `--dur-*` / `--ease-*` set; `--dur-story` and `--dur-exit` are aliases
of `--m-slow` and `--m-exit`. New motion uses only `--m-*`. The rules the components follow
are pure functions in `src/lib/motionMoments.ts`, tested in `motionMoments.test.ts`.

- **Try it wait** (`TryIt.tsx`, home and `/explain`): one step line, "Asking Vibe", for the
  whole request (the API answers with one JSON body, so there is no finer real step), with
  `aria-busy` on the answer area and a hidden "Loading explanation". Shimmer bars show only
  after 200 ms and stop when the answer lands; the answer shows whole at once.
- **Staggered arrival** (`Arrive.tsx`: the "Who it's for" cards, the `/releases` list): the
  first 8 children rise `--m-dist-sm` and fade in, `--m-normal`, `--m-stagger` apart, once,
  the first time the list scrolls into view. The start state is set only for a list that
  starts below the fold with motion allowed; server HTML always shows every item.
- **Count-up** (`CountUp.tsx`: `/investors` releases, `/rewards` friends joined): real
  counts only. 700 / 1000 / 1200 ms by size, `--m-ease-smooth`, tabular figures, once per
  page view. The server renders the final value; a server-rendered number counts only if
  it starts below the fold, a fetched one counts as it arrives. The `aria-label` holds the
  final value, and any click, key, wheel or touch scroll jumps to it.

## Reduced motion

`globals.css` collapses all animation and transition durations to near-zero under
`prefers-reduced-motion: reduce`. Ambient loops (marquee, caret, hero demo) additionally
check the preference in JS and stop rather than merely running instantly. Marquees also
pause on hover and focus-within.

## Rules of thumb

- If a motion does not help the user understand something, remove it.
- Never block interaction behind an animation; content is usable immediately.
- Keep durations short enough that repeat visits never feel slow.
