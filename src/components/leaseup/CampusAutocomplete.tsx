/**
 * Q100 — Campus typeahead used by every "Where" input (homepage hero,
 * nav compact search, campus landing hero).
 *
 * Typing filters the campus list (debounced 150ms); an empty focused input
 * shows the most active campuses. Keyboard: ↑/↓ to move, Enter to pick,
 * Escape to close. Picking a campus stores its id, not just the text.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import {
  fetchCampuses,
  fetchActiveListingCountsByCampus,
  campusMatchesQuery,
  type Campus,
} from "@/lib/leaseup/campuses";
import { cn } from "@/lib/utils";

export function CampusAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = "Search campuses…",
  autoFocus,
  className,
  inputClassName,
}: {
  value: string;
  onSelect: (c: Campus) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const [text, setText] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value), [value]);

  // Q179 — 200ms debounce; the list now covers every accredited US school so
  // the filtering happens server-side.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(text), 200);
    return () => window.clearTimeout(t);
  }, [text]);

  const q = debounced.trim();
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["campus-search", q.toLowerCase()],
    queryFn: () => searchCampuses(q, q ? 8 : 5),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => setActive(0), [q, open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(c: Campus) {
    setText(c.name);
    setOpen(false);
    onSelect(c);
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              if (open && results[active]) {
                e.preventDefault();
                pick(results[active]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label="Where"
          className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", inputClassName)}
        />
        {text && (
          <button
            type="button"
            aria-label="Clear campus"
            onClick={() => {
              setText("");
              setOpen(true);
              onClear?.();
            }}
            className="shrink-0 text-gray-400 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg dark:border-border dark:bg-surface">
          {!q && results.length > 0 && (
            <div className="px-3 pt-2 text-xs uppercase tracking-wide text-gray-400">
              Popular campuses
            </div>
          )}
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No campuses found
            </div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={cn(
                  "flex w-full items-baseline gap-2 px-3 py-2 text-left",
                  i === active ? "bg-gray-50 dark:bg-muted" : "hover:bg-gray-50 dark:hover:bg-muted",
                )}
              >
                <span className="truncate font-medium">{c.name}</span>
                {c.state && <span className="shrink-0 text-sm text-gray-400">· {c.state}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
