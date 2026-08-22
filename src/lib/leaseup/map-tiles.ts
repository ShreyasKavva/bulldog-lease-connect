/**
 * Q177 — single source of truth for the basemap.
 *
 * CARTO Positron: a muted grey/white canvas (soft green parks, pale water,
 * thin white roads, very few street labels) so white price pills pop.
 * Both OSM and CARTO require visible attribution — keep BASEMAP_OPTIONS intact.
 */
export const BASEMAP_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const BASEMAP_OPTIONS = {
  subdomains: "abcd",
  maxZoom: 20,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const;
