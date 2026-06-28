import { useNotificationPreferences } from "@/hooks/use-notifications";
import { Switch } from "@/components/ui/switch";

const ROWS: { key: keyof Defaults; label: string; description: string }[] = [
  { key: "new_message", label: "New messages", description: "When someone sends you a message." },
  { key: "listing_match", label: "Listing matches", description: "When a new listing matches a Looking For post." },
  { key: "price_drop", label: "Price drops", description: "When a listing you saved drops in price." },
  { key: "listing_saved", label: "Someone saved my listing", description: "When another student saves your post." },
  { key: "view_milestone", label: "View milestones", description: "Celebrate 50/100/250 view milestones." },
  { key: "new_review", label: "New reviews", description: "When someone leaves you a review." },
  { key: "looking_for_interest", label: "Looking For interest", description: "When someone might have a place for you." },
  { key: "lease_expiring", label: "Listing expiring", description: "Reminders before your listing or post expires." },
];

type Defaults = {
  new_message: boolean;
  listing_match: boolean;
  price_drop: boolean;
  listing_saved: boolean;
  view_milestone: boolean;
  new_review?: boolean;
  looking_for_interest?: boolean;
  lease_expiring?: boolean;
};

export function NotificationPreferences() {
  const { data, update, isLoading } = useNotificationPreferences();

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Notifications</h3>
        <span className="text-[11px] font-semibold text-muted-foreground">In-app & email</span>
      </div>
      <ul className="divide-y divide-border">
        {ROWS.map((row) => {
          const value = data?.[row.key] ?? false;
          return (
            <li key={row.key} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{row.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{row.description}</div>
              </div>
              <Switch
                checked={!!value}
                disabled={isLoading || update.isPending}
                onCheckedChange={(checked) => update.mutate({ [row.key]: checked } as Partial<Defaults>)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
