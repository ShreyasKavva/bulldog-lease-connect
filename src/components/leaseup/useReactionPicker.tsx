import { useEffect, useRef, useState, useCallback } from "react";
import { REACTION_META, REACTION_ORDER, useToggleReaction, type ReactionType } from "@/lib/leaseup/reactions";
import { useSession } from "@/lib/leaseup/use-session";
import { toast } from "sonner";

type FloatItem = { key: number; x: number; y: number; emoji: string };

/**
 * Long-press / right-click reaction picker, plus double-tap-to-fire with
 * a floating emoji. Returns event bindings to spread on the photo container
 * and an `overlay` to render inside the same (position:relative) container.
 */
export function useReactionPicker(listingId: string, opts?: { onReact?: (r: ReactionType) => void }) {
  const { user } = useSession();
  const toggle = useToggleReaction(listingId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const lastTap = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const fire = useCallback((r: ReactionType, x: number, y: number) => {
    if (!user) { toast.error("Sign in to react"); return; }
    toggle.mutate(r);
    opts?.onReact?.(r);
    const key = Date.now() + Math.random();
    setFloats((f) => [...f, { key, x, y, emoji: REACTION_META[r].emoji }]);
    setTimeout(() => setFloats((f) => f.filter((it) => it.key !== key)), 1100);
  }, [user, toggle, opts]);

  const clearHold = () => {
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  const openAt = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(80, Math.min(rect.width - 80, clientX - rect.left));
    const y = Math.max(60, clientY - rect.top);
    setPicker({ x, y });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return; // contextmenu handles right click
    heldRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      openAt(e.clientX, e.clientY);
    }, 500);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startPos.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (dx * dx + dy * dy > 100) clearHold();
  };
  const onPointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    clearHold();
    startPos.current = null;
  };
  const onPointerCancel = () => { clearHold(); startPos.current = null; };

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    openAt(e.clientX, e.clientY);
  };

  /**
   * Wrap a click handler so it is suppressed when a long-press fired.
   * Also detects double-tap → fires 🔥.
   * Returns true if the original click should be skipped.
   */
  const handleClick = (e: React.MouseEvent<HTMLDivElement>): { suppressed: boolean; doubleTapped: boolean } => {
    if (heldRef.current) {
      heldRef.current = false;
      return { suppressed: true, doubleTapped: false };
    }
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      fire("fire", e.clientX - rect.left, e.clientY - rect.top);
      return { suppressed: true, doubleTapped: true };
    }
    lastTap.current = now;
    return { suppressed: false, doubleTapped: false };
  };

  // Dismiss on outside click / escape
  useEffect(() => {
    if (!picker) return;
    function onDoc(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return setPicker(null);
      if (!(e.target instanceof Node) || !el.contains(e.target)) setPicker(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPicker(null); }
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [picker]);

  const bind = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
  };

  const overlay = (
    <>
      {picker && (
        <div
          className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-full select-none"
          style={{ left: picker.x, top: picker.y - 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="lu-reaction-pop flex items-center gap-1 rounded-full border border-white/40 bg-white/95 px-2 py-1.5 shadow-xl backdrop-blur">
            {REACTION_ORDER.map((r, i) => (
              <button
                key={r}
                type="button"
                title={REACTION_META[r].label}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = containerRef.current!.getBoundingClientRect();
                  fire(r, picker.x, picker.y);
                  setPicker(null);
                  void rect;
                }}
                className="grid h-10 w-10 place-items-center rounded-full text-2xl transition hover:scale-125 hover:bg-background active:scale-110"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {REACTION_META[r].emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      {floats.map((f) => (
        <span
          key={f.key}
          className="lu-float-up pointer-events-none absolute z-30 text-5xl drop-shadow-lg"
          style={{ left: f.x, top: f.y }}
        >
          {f.emoji}
        </span>
      ))}
    </>
  );

  return { containerRef, bind, overlay, handleClick };
}
