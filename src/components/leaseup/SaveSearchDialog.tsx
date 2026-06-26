import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export type SearchFilters = {
  area: string;
  maxPrice: number;
  furnishedOnly: boolean;
  petFriendlyOnly?: boolean;
  minBeds?: number;
  keyword: string;
};

export function SaveSearchDialog({
  open, onOpenChange, filters,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: SearchFilters;
}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) return;
    if (!name.trim()) { toast.error("Give your alert a name"); return; }
    setSaving(true);
    const { error } = await supabase.from("saved_searches").insert({
      user_id: user.id,
      name: name.trim(),
      campus_id: profile?.campus_id ?? null,
      area: filters.area || null,
      max_price: filters.maxPrice ?? null,
      min_beds: filters.minBeds ?? null,
      furnished_only: !!filters.furnishedOnly,
      pet_friendly_only: !!filters.petFriendlyOnly,
      keyword: filters.keyword?.trim() || null,
      notify: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["saved-searches", user.id] });
    toast.success("Alert saved — we'll ping you when a match drops");
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Save this search
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Alert name</Label>
            <Input
              autoFocus
              placeholder="e.g. 2BR under $1100 near campus"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="rounded-xl bg-background p-3 text-xs">
            <div className="mb-1 font-bold uppercase tracking-wide text-muted-foreground">Filters</div>
            <ul className="space-y-0.5 text-foreground">
              <li>Max ${filters.maxPrice}/mo</li>
              {filters.area && <li>Area: {filters.area}</li>}
              {filters.minBeds ? <li>{filters.minBeds}+ beds</li> : null}
              {filters.furnishedOnly && <li>Furnished only</li>}
              {filters.petFriendlyOnly && <li>Pet-friendly only</li>}
              {filters.keyword && <li>Keyword: "{filters.keyword}"</li>}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            You'll get an in-app notification the moment a new listing matches.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
            {saving ? "Saving…" : "Create alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
