/**
 * Q177 — single source of truth for the basemap.
 *
 * CARTO Voyager: a calm but coloured canvas — green parks, blue water, a clear
 * road hierarchy and named landmark POIs for orientation, without raw-OSM
 * clutter (no red highways, route shields or dense building footprints).
 * Both OSM and CARTO require visible attribution — keep BASEMAP_OPTIONS intact.
 */
export const BASEMAP_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export const BASEMAP_OPTIONS = {
  subdomains: "abcd",
  maxZoom: 20,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const;
