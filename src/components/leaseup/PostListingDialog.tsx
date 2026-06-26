import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { NEIGHBORHOODS, AMENITIES } from "@/lib/leaseup/constants";
import { supabase } from "@/integrations/supabase/client";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteRoommatesDialog } from "@/components/leaseup/InviteRoommatesDialog";

export function PostListingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", type: "sublease", price: "",
    beds: "1", baths: "1", area: NEIGHBORHOODS[0].name,
    available_from: "", available_to: "",
    furnished: false, utilities_included: false, pet_friendly: false, parking: false,
    amenities: [] as string[],
  });

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleAmenity(a: string) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }));
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const arr = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  }

  async function submit() {
    if (!user || !profile?.campus_id) { toast.error("Complete your profile first"); return; }
    if (!form.title || !form.price) { toast.error("Title and price required"); return; }
    setSubmitting(true);
    try {
      // Check if this is the user's first listing for the invite prompt
      const { count: existingCount } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const photos = files.length ? await uploadListingPhotos(user.id, files) : [];
      const hood = NEIGHBORHOODS.find(n => n.name === form.area);
      const { error } = await supabase.from("listings").insert({
        user_id: user.id,
        campus_id: profile.campus_id,
        title: form.title,
        description: form.description,
        type: form.type,
        price: parseInt(form.price),
        beds: parseInt(form.beds),
        baths: parseFloat(form.baths),
        area: form.area,
        lat: hood?.lat, lng: hood?.lng,
        furnished: form.furnished,
        utilities_included: form.utilities_included,
        pet_friendly: form.pet_friendly,
        parking: form.parking,
        available_from: form.available_from || null,
        available_to: form.available_to || null,
        amenities: form.amenities,
        photos,
      });
      if (error) throw error;
      toast.success("🎉 Listing posted!");
      qc.invalidateQueries({ queryKey: ["listings"] });
      onOpenChange(false);
      setForm({ ...form, title: "", description: "", price: "" });
      setFiles([]);
      if ((existingCount ?? 0) === 0) {
        setInviteOpen(true);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl">Post a sublease</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Cozy 1BR near North Campus" /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly rent ($)"><Input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="850" /></Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sublease">Sublease</SelectItem>
                  <SelectItem value="transfer">Lease Transfer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Beds"><Input type="number" value={form.beds} onChange={(e) => setField("beds", e.target.value)} /></Field>
            <Field label="Baths"><Input type="number" step="0.5" value={form.baths} onChange={(e) => setField("baths", e.target.value)} /></Field>
            <Field label="Neighborhood">
              <Select value={form.area} onValueChange={(v) => setField("area", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NEIGHBORHOODS.map(n => <SelectItem key={n.name} value={n.name}>{n.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Available from"><Input type="date" value={form.available_from} onChange={(e) => setField("available_from", e.target.value)} /></Field>
            <Field label="Available until"><Input type="date" value={form.available_to} onChange={(e) => setField("available_to", e.target.value)} /></Field>
          </div>

          <Field label="Description">
            <Textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Tell other students about the place…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <ToggleField label="Furnished" checked={form.furnished} onChange={(v) => setField("furnished", v)} />
            <ToggleField label="Utilities included" checked={form.utilities_included} onChange={(v) => setField("utilities_included", v)} />
            <ToggleField label="Pet friendly" checked={form.pet_friendly} onChange={(v) => setField("pet_friendly", v)} />
            <ToggleField label="Parking" checked={form.parking} onChange={(v) => setField("parking", v)} />
          </div>

          <Field label="Amenities">
            <div className="flex flex-wrap gap-1.5">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition",
                    form.amenities.includes(a) ? "border-primary bg-primary-light text-primary-dark" : "border-border text-muted-foreground hover:border-primary"
                  )}>{a}</button>
              ))}
            </div>
          </Field>

          <Field label={`Photos (${files.length}/10)`}>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                📷 Take Photo
                <input type="file" accept="image/*" capture="environment" multiple onChange={onFiles} className="hidden" />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                <Upload className="h-4 w-4" />Choose from Library
                <input type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-2 grid grid-cols-5 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    <button aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Button disabled={submitting} onClick={submit} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11">
            {submitting ? "Posting…" : "Post listing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1.5"><Label className="text-xs font-bold uppercase text-muted-foreground">{label}</Label>{children}</div>);
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-surface px-3 py-2.5">
      <span className="text-sm font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
