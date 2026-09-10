## Q197 plan

- Update only `src/components/leaseup/CountUp.tsx`.
- Preserve the target value during server rendering and immediately show it when the page is hidden or reduced motion is enabled.
- Keep the existing count-up effect for visible pages, with a `duration + 400ms` timeout that always settles on the target.
- Add and clean up a visibility listener that snaps an incomplete count to the target when the page becomes visible.
- Verify the homepage normally, hidden, reduced-motion, and at 375px; verify every other `CountUp` usage; verify signed-out browse Grid and Map; verify direct server-rendered `/` response and build health.
- Do not change stats data, map code, policies, routes, copy, styling, or layout.
