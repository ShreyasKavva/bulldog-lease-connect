/**
 * Q267 — term presets that follow the school's own academic calendar.
 *
 * Most US campuses run on semesters (Fall / Spring / Summer). A well-known
 * minority run on quarters (Fall / Winter / Spring / Summer). We pick the set
 * from the campus the poster selected, and the dates roll with the current
 * academic year so a preset is never in the past.
 */

export type TermPreset = { label: string; from: string; to: string };

/** Schools on the quarter system, matched loosely against the campus name. */
const QUARTER_PATTERNS = [
  /university of california, (los angeles|davis|irvine|san diego|santa barbara|santa cruz|riverside)/i,
  /\bucla\b/i,
  /\buc (davis|irvine|san diego|santa barbara|santa cruz|riverside)\b/i,
  /california polytechnic|cal poly/i,
  /stanford university/i,
  /northwestern university/i,
  /university of chicago/i,
  /dartmouth college/i,
  /california institute of technology/i,
  /university of washington/i,
  /university of oregon/i,
  /oregon state university/i,
  /washington state university/i,
  /\bdrexel university\b/i,
  /\bnortheastern university\b/i,
  /university of denver/i,
  /university of utah/i,
  /ohio northern university/i,
];

export function isQuarterSystem(campusName?: string | null): boolean {
  if (!campusName) return false;
  return QUARTER_PATTERNS.some((re) => re.test(campusName));
}

/** Year the current academic calendar started (Fall of that year). */
function academicYearStart(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

const pad = (n: number) => String(n).padStart(2, "0");
const day = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function termPresets(campusName?: string | null, now = new Date()): TermPreset[] {
  const y = academicYearStart(now);
  const n = y + 1;

  if (isQuarterSystem(campusName)) {
    return [
      { label: `Fall ${y}`, from: day(y, 9, 20), to: day(y, 12, 15) },
      { label: `Winter ${n}`, from: day(n, 1, 3), to: day(n, 3, 20) },
      { label: `Spring ${n}`, from: day(n, 3, 25), to: day(n, 6, 15) },
      { label: `Summer ${n}`, from: day(n, 6, 20), to: day(n, 9, 10) },
      { label: "Full Year", from: day(y, 9, 20), to: day(n, 6, 15) },
    ];
  }

  return [
    { label: `Fall ${y}`, from: day(y, 8, 20), to: day(y, 12, 20) },
    { label: `Spring ${n}`, from: day(n, 1, 10), to: day(n, 5, 10) },
    { label: `Summer ${n}`, from: day(n, 5, 15), to: day(n, 8, 15) },
    { label: "Full Year", from: day(y, 8, 20), to: day(n, 5, 10) },
  ];
}
