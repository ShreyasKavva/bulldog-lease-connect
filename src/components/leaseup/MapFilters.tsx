import { useState } from "react";
import { Bed, DollarSign, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapFiltersValue = {
  type: "all" | "sublease" | "transfer";
  maxPrice: number | null;
  minBeds: number | null;
  hotOnly: boolean;
};

export const DEFAULT_FILTERS: MapFiltersValue = {
  type: "all",
  maxPrice: null,
  minBeds: null,
  hotOnly: false,
};

const PRICE_OPTIONS = [600, 800, 1000, 1200, 1500, 2000];
const BED_OPTIONS = [1, 2, 3, 4];

export function MapFilters({
  value,
  onChange,
}: {
  value: MapFiltersValue;
  onChange: (v: MapFiltersValue) => void;
}) {
  const [openMenu, setOpenMenu] = useState<"price" | "beds" | "type" | null>(null);
  const active =
    value.type !== "all" || value.maxPrice != null || value.minBeds != null || value.hotOnly;

  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full bg-surface/95 p-1 shadow-card-md backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Type chip */}
      <FilterChip
        label={
          value.type === "all" ? "All" : value.type === "sublease" ? "Subleases" : "Transfers"
        }
        active={value.type !== "all"}
        onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}
      >
        {openMenu === "type" && (
          <Popover onClose={() => setOpenMenu(null)}>
            {(["all", "sublease", "transfer"] as const).map((t) => (
              <PopoverItem
                key={t}
                active={value.type === t}
                onClick={() => {
                  onChange({ ...value, type: t });
                  setOpenMenu(null);
                }}
              >
                {t === "all" ? "All listings" : t === "sublease" ? "Subleases" : "Lease transfers"}
              </PopoverItem>
            ))}
          </Popover>
        )}
      </FilterChip>

      {/* Price chip */}
      <FilterChip
        icon={<DollarSign className="h-3.5 w-3.5" />}
        label={value.maxPrice ? `≤ $${value.maxPrice}` : "Price"}
        active={value.maxPrice != null}
        onClick={() => setOpenMenu(openMenu === "price" ? null : "price")}
      >
        {openMenu === "price" && (
          <Popover onClose={() => setOpenMenu(null)}>
            <PopoverItem
              active={value.maxPrice == null}
              onClick={() => {
                onChange({ ...value, maxPrice: null });
                setOpenMenu(null);
              }}
            >
              Any price
            </PopoverItem>
            {PRICE_OPTIONS.map((p) => (
              <PopoverItem
                key={p}
                active={value.maxPrice === p}
                onClick={() => {
                  onChange({ ...value, maxPrice: p });
                  setOpenMenu(null);
                }}
              >
                Up to ${p}/mo
              </PopoverItem>
            ))}
          </Popover>
        )}
      </FilterChip>

      {/* Beds chip */}
      <FilterChip
        icon={<Bed className="h-3.5 w-3.5" />}
        label={value.minBeds ? `${value.minBeds}+ bd` : "Beds"}
        active={value.minBeds != null}
        onClick={() => setOpenMenu(openMenu === "beds" ? null : "beds")}
      >
        {openMenu === "beds" && (
          <Popover onClose={() => setOpenMenu(null)}>
            <PopoverItem
              active={value.minBeds == null}
              onClick={() => {
                onChange({ ...value, minBeds: null });
                setOpenMenu(null);
              }}
            >
              Any beds
            </PopoverItem>
            {BED_OPTIONS.map((n) => (
              <PopoverItem
                key={n}
                active={value.minBeds === n}
                onClick={() => {
                  onChange({ ...value, minBeds: n });
                  setOpenMenu(null);
                }}
              >
                {n}+ bedroom{n > 1 ? "s" : ""}
              </PopoverItem>
            ))}
          </Popover>
        )}
      </FilterChip>

      {/* Hot deals toggle */}
      <button
        onClick={() => onChange({ ...value, hotOnly: !value.hotOnly })}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
          value.hotOnly
            ? "bg-warning text-warning-foreground"
            : "bg-background text-foreground hover:bg-border",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Hot
      </button>

      {active && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          aria-label="Reset filters"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background text-muted-foreground hover:bg-border"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onClick,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-background text-foreground hover:bg-border",
        )}
      >
        {icon}
        {label}
      </button>
      {children}
    </div>
  );
}

function Popover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-2xl border border-border bg-surface p-1.5 shadow-card-lg">
      <div className="mb-1 flex items-center justify-between px-2 pt-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          Filter
        </span>
        <button
          onClick={onClose}
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-background"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function PopoverItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-background",
        active && "bg-primary-light text-primary-dark",
      )}
    >
      {children}
    </button>
  );
}
