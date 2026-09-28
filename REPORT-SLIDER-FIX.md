# Fix report — project slider

Date: 2026-09-28

## Problem
The portfolio slider changed its `index`, but the track transform used a CSS `calc()` expression with multiplication:

`translateX(calc(-${index} * (min(78vw, 780px) + 18px)))`

That expression is not a reliable browser transform value in this form, so the browser can ignore it. The first project remained visible and navigation appeared not to work.

## Fix
`components/portfolio-slider.tsx` now measures the real first-slide width plus the track gap and applies a concrete pixel transform:

`translate3d(-${index * slideStep}px, 0, 0)`

A `ResizeObserver` recomputes the step when the responsive slide width changes.

## Data check
`app/page.tsx` already retrieves up to 8 public projects with `findMany({ where: { isPublic: true } })`, so the data layer was not limiting the page to one project.

## Verification
- TypeScript transpilation/syntax check of `components/portfolio-slider.tsx`: PASS
- Confirmed old invalid transform is absent: PASS
- Confirmed measured transform is present: PASS
- Full `npm test` from this uploaded archive: NOT RUNNABLE because `vitest` is unavailable in the archive runtime after dependency installation timed out.
- Full `npm run typecheck`: NOT RUNNABLE in this archive runtime because required type packages are missing from the available `node_modules`.

The live server's existing test suite should be rerun after copying this fix and installing dependencies.
