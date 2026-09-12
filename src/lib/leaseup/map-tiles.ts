/**
 * Q177 — single source of truth for the basemap. No component may inline a
 * tile URL; every map reads these exports.
 * Q202 — switched back to CARTO Voyager (key-free raster tiles confirmed
 * serving again) after Q191's temporary move to raw OSM tiles. Voyager gives
 * the light, detailed cartography the price-bubble map is designed around.
 * Attribution credits both OpenStreetMap and CARTO and is legally required —
 * keep it visible.
 */
export const BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const BASEMAP_OPTIONS = {
  maxZoom: 19,
  subdomains: "abcd",
  attribution: BASEMAP_ATTRIBUTION,
} as const;
