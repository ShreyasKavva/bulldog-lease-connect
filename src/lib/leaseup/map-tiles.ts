/**
 * Q177 — single source of truth for the basemap.
 * Q191 — switched off CARTO Voyager (keyless endpoint now returns
 * "API KEY REQUIRED" watermark tiles) to the standard OpenStreetMap
 * raster tiles, which render key-free. OSM requires visible attribution —
 * keep BASEMAP_OPTIONS intact.
 */
export const BASEMAP_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const BASEMAP_OPTIONS = {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
} as const;
