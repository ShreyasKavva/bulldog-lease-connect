/**
 * Q177 — single source of truth for the basemap. No component may inline a
 * tile URL; every map reads these exports.
 * Q191 — switched off CARTO Voyager (keyless endpoint now returns
 * "API KEY REQUIRED" watermark tiles) to the standard OpenStreetMap
 * raster tiles, which render key-free.
 * Q202 — re-verified: every CARTO basemap path (voyager, light_all, etc.)
 * still bakes an "API KEY REQUIRED" watermark into the tile images, so
 * OSM stays. OSM requires visible attribution — keep it intact.
 */
export const BASEMAP_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Q480 — the same credit as plain text/URL, for places that render the
 * attribution outside the Leaflet control (e.g. a caption under the map, which
 * stays visible when the in-map control is clipped by a fixed bottom bar).
 */
export const BASEMAP_ATTRIBUTION_TEXT = "OpenStreetMap contributors";
export const BASEMAP_ATTRIBUTION_HREF = "https://www.openstreetmap.org/copyright";

export const BASEMAP_OPTIONS = {
  maxZoom: 19,
  attribution: BASEMAP_ATTRIBUTION,
} as const;
