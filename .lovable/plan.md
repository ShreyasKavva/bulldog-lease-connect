## Problem

The home route crashes with `ReferenceError: L is not defined`, thrown from `leaflet.markercluster` at module load. That takes down the whole page via the root error boundary.

Root cause is in `src/components/leaseup/MapHome.tsx`:

```
import "leaflet.markercluster";                              // runs at module load
...
const L = (await import("leaflet")).default;                 // runs later, in useEffect
```

`leaflet.markercluster` is a plugin that expects the Leaflet global `L` to already exist on `window`. Because Leaflet itself is loaded lazily inside a `useEffect`, the plugin executes first, finds no `L`, and throws — before any map code runs.

## Fix

In `src/components/leaseup/MapHome.tsx`:

1. Remove the top-level `import "leaflet.markercluster";`.
2. Keep the two CSS imports at the top (they're safe and needed for cluster styling).
3. Inside the effect that already does `const L = (await import("leaflet")).default;`, attach `L` to `window` (`(window as any).L = L`) and then `await import("leaflet.markercluster")` so the plugin registers against the loaded Leaflet.

This preserves current map/cluster behavior and matches how `MapView.tsx` already lazy-loads Leaflet.

## Verification

- Flush HMR and reload `/`; confirm the error boundary is gone and the feed renders.
- Open the map view and confirm clustered pins still appear.
