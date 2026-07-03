/**
 * Vibration API haptics — best-effort, safe no-op on unsupported browsers
 * (iOS Safari, desktop). Call from user gesture handlers only.
 */
export type HapticPattern = "light" | "medium" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 30,
  success: [10, 50, 10],
  warning: [20, 40, 20, 40],
};

export function haptic(pattern: HapticPattern = "light") {
  if (typeof navigator === "undefined") return;
  const vibrate = (navigator as Navigator).vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(PATTERNS[pattern]);
  } catch {
    /* noop */
  }
}
