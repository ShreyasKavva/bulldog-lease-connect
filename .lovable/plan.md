# Fix Twitter link and heart counts

## Changes
- Remove the X/Twitter icon and link from the footer, including its unused icon import.
- Make the shared save action report whether a save or unsave actually succeeded, and surface database failures correctly.
- Guard each heart while its save request is in progress so ignored double-clicks never alter the displayed number.
- Update card, trending, and listing-detail counts by exactly one after each successful save or unsave; roll back cleanly on failure.

## Verification
- Check signed-in save, unsave, rapid double-click, and refresh behavior on a real listing.
- Confirm the same result on regular cards, Trending, and listing detail.
- Check `/browse` at 375px, then run typecheck, lint, and build validation.

## Technical details
- Keep existing database triggers and access rules unchanged.
- Preserve the flat Saved experience and existing heart styling.
