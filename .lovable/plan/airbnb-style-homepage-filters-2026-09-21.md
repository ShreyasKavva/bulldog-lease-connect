# Airbnb-style homepage filters

## What will change
- Replace the small filter dropdown with a wider, mobile-friendly filter panel.
- Add a monthly price section with an Airbnb-style price distribution bar and range control.
- Show the live number of subleases remaining as the price and category filters change.
- Keep the existing filter choices, school-aware “Near …” label, and clear-filter behavior.
- Apply the selected price range to every homepage listing row without changing Browse, search, maps, or backend logic.

## Visual direction
- White surface, crisp dividers, compact typography, rounded controls, and a strong dark “Show N subleases” action.
- Price bars reflect the actual loaded listing prices rather than decorative sample data.
- On phones, the panel remains fully usable at 375px with large tap targets and no horizontal overflow.

## Technical details
- Keep filter state local to the homepage and derive counts from the existing loaded listing data.
- Compute histogram buckets and filtered counts with memoized calculations.
- Use semantic design tokens and existing popover/slider controls; no new dependency.
- Verify typecheck, lint, build, and the homepage plus Browse at 375px.
