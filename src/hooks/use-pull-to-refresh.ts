/**
 * Native-feel pull-to-refresh. Attach the returned `bind` props to a scroll
 * container (or use the window default), and pass an async onRefresh.
 *
 * - Only engages when the container is scrolled to the top.
 * - Ignores if the user starts dragging inside an interactive element
 *   (buttons, inputs, sliders, [data-no-ptr]).
 * - `pull` is 0..1 (past threshold clamps to 1 with rubber-band).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/leaseup/haptics";

const THRESHOLD = 70;
const MAX_PULL = 140;

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const triggered = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button,input,textarea,select,[data-no-ptr]")) return;
    if (window.scrollY > 2) return;
    startY.current = e.touches[0].pageY;
    active.current = true;
    triggered.current = false;
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!active.current || startY.current == null) return;
    const delta = e.touches[0].pageY - startY.current;
    if (delta <= 0) { setPull(0); return; }
    // rubber-band
    const eased = Math.min(MAX_PULL, delta * 0.55);
    setPull(eased / THRESHOLD);
    if (eased >= THRESHOLD && !triggered.current) {
      triggered.current = true;
      haptic("light");
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    const shouldRefresh = triggered.current;
    startY.current = null;
    if (shouldRefresh) {
      setRefreshing(true);
      setPull(1);
      try { await onRefresh(); } catch { /* noop */ }
      setRefreshing(false);
    }
    setPull(0);
  }, [onRefresh]);

  useEffect(() => {
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { pull, refreshing };
}
