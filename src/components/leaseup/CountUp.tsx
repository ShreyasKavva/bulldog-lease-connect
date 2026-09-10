import { useEffect, useRef, useState } from "react";

/** Animated count-up number. Easing: ease-out. */
export function CountUp({
  value,
  duration = 700,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  // The real value is the SSR and hydration-safe default. Animation is an
  // enhancement, so a throttled or suspended frame can never strand this at 0.
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let settled = false;

    const updateDisplay = (next: number) => {
      displayRef.current = next;
      setDisplay(next);
    };

    const settle = () => {
      settled = true;
      if (raf) cancelAnimationFrame(raf);
      fromRef.current = value;
      updateDisplay(value);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && displayRef.current < value) settle();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (document.hidden || reduce) {
      settle();
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (raf) cancelAnimationFrame(raf);
      };
    }

    const from = fromRef.current;
    const start = performance.now();
    if (value > 0 && from <= 0) updateDisplay(1);

    const tick = (now: number) => {
      if (settled) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      updateDisplay(value > 0 ? Math.max(1, next) : next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else settle();
    };

    raf = requestAnimationFrame(tick);
    const fallback = window.setTimeout(settle, duration + 400);

    return () => {
      settled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : display.toLocaleString()}</span>;
}
