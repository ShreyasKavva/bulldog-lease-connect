import { Sun, Moon, MonitorCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemePref } from "@/lib/leaseup/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: MonitorCog },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">Appearance</div>
          <div className="text-xs text-muted-foreground">Choose how LeaseUp looks on this device.</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-background p-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.97]",
                active
                  ? "bg-surface text-primary shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
