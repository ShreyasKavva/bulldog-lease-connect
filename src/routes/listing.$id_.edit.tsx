/**
 * /listing/$id/edit — single-page edit form for a sublease (owner only).
 *
 * Not a wizard: every field from the post flow shown at once, pre-filled from
 * the existing row. Ownership is checked client-side (and enforced by RLS).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { CampusAvgPriceHint } from "@/components/leaseup/CampusAvgPriceHint";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listing/$id_/edit")({
  head: () => ({
    meta: [
      { title: "Edit sublease — LeaseUp" },
      { name: "description", content: "Update your sublease listing details, photos, price and dates." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditListingRoute,
});

const PLACE_TYPES = [
  { id: "entire", label: "Entire apartment", emoji: "🏢" },
  { id: "private", label: "Private room", emoji: "🚪" },
  { id: "shared", label: "Shared room", emoji: "🛏️" },
  { id: "studio", label: "Studio", emoji: "🏠" },
] as const;

const AMENITIES = [
  { id: "furnished", label: "Furnished" },
  { id: "utilities_included", label: "Utilities included" },
  { id: "parking", label: "Parking" },
  { id: "pet_friendly", label: "Pets allowed" },
  { id: "wifi", label: "WiFi" },
  { id: "laundry", label: "In-unit laundry" },
  { id: "ac", label: "A/C" },
  { id: "gym", label: "Pool/gym" },
] as const;

const SIGNED_TTL = 60 * 60 * 24 * 7;

type Form = {
  title: string;
  placeType: string;
  campusId: string;
  area: string;
  address: string;
  beds: number;
  baths: number;
  occupants: number;
  price: string;
  from: string;
  to: string;
  description: string;
  amenities: string[];
  photos: string[];
};

function EditListingRoute() {
  const { id } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const prompted = useRef(false);

  useEffect(() => {
    if (loading || user || prompted.current) return;
    prompted.current = true;
    openSignIn(`/listing/${id}/edit`);
  }, [loading, user, id]);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing-edit", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Record<string, any> | null;
    },
  });

  useEffect(() => {
    if (!user || !listing) return;
    if (listing.user_id !== user.id) {
      toast.error("You can only edit your own listings");
      navigate({ to: "/listing/$id", params: { id } });
    }
  }, [user, listing, id, navigate]);

  if (loading || (user && isLoading)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">Sign in to edit your listing.</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Listing not found</h1>
        <Link to="/my-listings" className="text-sm font-semibold text-primary hover:underline">
          Back to your listings →
        </Link>
      </main>
    );
  }

  if (listing.user_id !== user.id) return <div className="min-h-[60vh]" />;

  return <EditForm listingId={id} listing={listing} userId={user.id} />;
}

function EditForm({ listingId, listing, userId }: { listingId: string; listing: Record<string, any>; userId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const { data: campusesWithListings = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: 300_000 });
  // Q179 — the chosen campus may have no other listings, so resolve it by id.
  const [pickedCampus, setPickedCampus] = useState<Campus | null>(null);
  const campuses = pickedCampus && !campusesWithListings.some((c) => c.id === pickedCampus.id)
    ? [...campusesWithListings, pickedCampus]
    : campusesWithListings;

  const [form, setForm] = useState<Form>(() => {
    const extras: string[] = Array.isArray(listing.amenities) ? listing.amenities : [];
    const amenities = [
      ...(listing.furnished ? ["furnished"] : []),
      ...(listing.utilities_included ? ["utilities_included"] : []),
      ...(listing.parking ? ["parking"] : []),
      ...(listing.pet_friendly ? ["pet_friendly"] : []),
      ...(listing.wifi_included ? ["wifi"] : []),
      ...(listing.laundry ? ["laundry"] : []),
      ...extras.filter((a) => a === "ac" || a === "gym"),
    ];
    return {
      title: listing.title ?? "",
      placeType: extras.find((a) => PLACE_TYPES.some((p) => p.id === a)) ?? "entire",
      campusId: listing.campus_id ?? "",
      area: listing.area ?? "",
      address: listing.address ?? "",
      beds: listing.beds ?? 1,
      baths: Number(listing.baths ?? 1),
      occupants: extras.includes("occupants:2") ? 2 : Math.max(1, listing.beds ?? 1),
      price: String(listing.price ?? ""),
      from: listing.available_from ?? "",
      to: listing.available_to ?? "",
      description: listing.description ?? "",
      amenities,
      photos: Array.isArray(listing.photos) ? listing.photos : [],
    };
  });

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  // Signed URLs for existing photos
  const { data: photoUrls = {} } = useQuery({
    queryKey: ["listing-edit-photos", listingId, form.photos.join(",")],
    enabled: form.photos.length > 0,
    queryFn: async () => {
      const signed = await signPaths("listing-photos", form.photos, { ttl: SIGNED_TTL });
      return Object.fromEntries(signed) as Record<string, string>;
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 10);
    setUploading({ done: 0, total: arr.length });
    try {
      const paths = await uploadListingPhotos(userId, arr, (done, total) => setUploading({ done, total }));
      set({ photos: [...form.photos, ...paths] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Give your listing a title"); return; }
    if (!form.campusId) { toast.error("Pick a campus"); return; }
    const price = parseInt(form.price, 10);
    if (!Number.isFinite(price) || price <= 0) { toast.error("Enter a monthly rent"); return; }

    setSaving(true);
    const a = new Set(form.amenities);
    const extras = [form.placeType, ...(a.has("ac") ? ["ac"] : []), ...(a.has("gym") ? ["gym"] : [])];
    const { error } = await supabase
      .from("listings")
      .update({
        title: form.title.trim(),
        campus_id: form.campusId,
        area: form.area.trim() || null,
        address: form.address.trim() || null,
        beds: form.beds,
        baths: form.baths,
        price,
        available_from: form.from || null,
        available_to: form.to || null,
        description: form.description.trim(),
        furnished: a.has("furnished"),
        utilities_included: a.has("utilities_included"),
        parking: a.has("parking"),
        pet_friendly: a.has("pet_friendly"),
        wifi_included: a.has("wifi"),
        laundry: a.has("laundry") ? "in-unit" : null,
        amenities: extras,
        photos: form.photos,
      })
      .eq("id", listingId);
    setSaving(false);

    if (error) {
      toast.error("Something went wrong — try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["listing"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    toast.success("Listing updated! ✅");
    navigate({ to: "/listing/$id", params: { id: listingId } });
  }

  const saveBtn = (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className="rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60 dark:bg-foreground dark:text-background"
    >
      {saving ? "Saving…" : "Save changes"}
    </button>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/listing/$id"
          params={{ id: listingId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listing
        </Link>

        <div className="mt-3 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Edit sublease</h1>
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              to="/listing/$id"
              params={{ id: listingId }}
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </Link>
            {saveBtn}
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-foreground"
            />
          </Field>

          <Field label="Property type">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PLACE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ placeType: t.id })}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    form.placeType === t.id ? "border-foreground bg-surface shadow-sm" : "border-border bg-surface hover:border-foreground/40",
                  )}
                >
                  <div className="text-xl">{t.emoji}</div>
                  <div className="mt-1 text-sm font-semibold">{t.label}</div>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Campus">
              <div className="w-full rounded-xl border border-border bg-surface px-4 py-3">
                <CampusAutocomplete
                  value={campuses.find((c) => c.id === form.campusId)?.name ?? ""}
                  placeholder="Search your school…"
                  onSelect={(c) => { setPickedCampus(c); set({ campusId: c.id }); }}
                  onClear={() => set({ campusId: "" })}
                />
              </div>
            </Field>
            <Field label="Neighborhood">
              <input
                value={form.area}
                onChange={(e) => set({ area: e.target.value })}
                placeholder="e.g. Five Points"
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-foreground"
              />
            </Field>
          </div>

          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="e.g. 120 Baxter St"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-foreground"
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-3">
            <Stepper label="Bedrooms" value={form.beds} min={0} onChange={(v) => set({ beds: v })} />
            <Stepper label="Bathrooms" value={form.baths} min={0} step={0.5} onChange={(v) => set({ baths: v })} />
            <Stepper label="Max occupants" value={form.occupants} min={1} onChange={(v) => set({ occupants: v })} />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Monthly rent">
              <div className="flex items-center rounded-xl border border-border bg-surface px-4">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => set({ price: e.target.value })}
                  className="w-full bg-transparent py-3 pl-1 text-sm outline-none"
                />
              </div>
              <CampusAvgPriceHint
                campusId={form.campusId}
                campusName={campuses.find((c) => c.id === form.campusId)?.name}
              />
            </Field>
            <Field label="Available from">
              <input
                type="date"
                value={form.from}
                onChange={(e) => set({ from: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-foreground"
              />
            </Field>
            <Field label="Available until">
              <input
                type="date"
                value={form.to}
                onChange={(e) => set({ to: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-foreground"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-foreground"
            />
          </Field>

          <Field label="Amenities">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {AMENITIES.map((a) => {
                const on = form.amenities.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      set({ amenities: on ? form.amenities.filter((x) => x !== a.id) : [...form.amenities, a.id] })
                    }
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm font-medium transition",
                      on ? "border-foreground bg-surface shadow-sm" : "border-border bg-surface hover:border-foreground/40",
                    )}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Photos">
            {form.photos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {form.photos.map((p) => (
                  <div key={p} className="relative">
                    <img
                      src={photoUrls[p] ?? ""}
                      alt="Listing photo"
                      className="h-20 w-28 rounded-xl bg-muted object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => set({ photos: form.photos.filter((x) => x !== p) })}
                      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-gray-900 text-white shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border py-8 text-sm font-medium text-muted-foreground hover:border-foreground/40"
            >
              <ImagePlus className="h-5 w-5" />
              Add more photos
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void handleUpload(e.target.files)}
            />
            {uploading && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-all"
                    style={{ width: `${Math.round((uploading.done / uploading.total) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploading {uploading.done} of {uploading.total}…
                </p>
              </div>
            )}
          </Field>
        </div>
      </main>

      {/* Sticky mobile save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-surface p-3 sm:hidden">
        <Link
          to="/listing/$id"
          params={{ id: listingId }}
          className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-foreground dark:text-background"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Stepper({
  label, value, onChange, min = 0, step = 1,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <Field label={label}>
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
          className="grid h-9 w-9 place-items-center rounded-full border border-border"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + step)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </Field>
  );
}
