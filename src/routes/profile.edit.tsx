/**
 * /profile/edit — edit your own profile (auth-gated).
 * Avatar upload -> "avatars" bucket at <userId>/avatar-<ts>.<ext>.
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { SignInGate } from "@/components/leaseup/SignInGate";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { fetchCampusesByIds, type Campus } from "@/lib/leaseup/campuses";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({
    meta: [
      { title: "Edit your profile — LeaseUp" },
      { name: "description", content: "Update your LeaseUp student profile — photo, bio, school and grad year." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Edit your profile — LeaseUp" },
      { property: "og:description", content: "Update your LeaseUp student profile." },
    ],
  }),
  component: EditProfilePage,
});

const BIO_MAX = 300;

function EditProfilePage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [major, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [campus, setCampus] = useState<Campus | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-edit", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, bio, major, year, avatar_url, campus_id")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: profileCampus = [] } = useQuery({
    queryKey: ["campus-by-id", profile?.campus_id],
    queryFn: () => fetchCampusesByIds(profile?.campus_id ? [profile.campus_id] : []),
    enabled: !!profile?.campus_id,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setBio(profile.bio ?? "");
    setMajor(profile.major ?? "");
    setYear(profile.year ?? "");
    setAvatarPath(profile.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    if (!campus && profileCampus[0]) setCampus(profileCampus[0]);
  }, [campus, profileCampus]);

  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar-url", avatarPath],
    queryFn: async () => {
      if (!avatarPath) return null;
      if (avatarPath.startsWith("http")) return avatarPath;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60);
      return data?.signedUrl ?? null;
    },
    enabled: !!avatarPath,
  });

  if (loading) return <div className="min-h-[60vh]" />;
  if (!user) {
    return <SignInGate title="Sign in to edit your profile" body="You need to sign in to update your LeaseUp profile." next="/profile/edit" />;
  }

  async function upload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;
      const { error: upErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (upErr) throw upErr;
      setAvatarPath(path);
      qc.invalidateQueries({ queryKey: ["public-profile", user.id] });
      toast.success("Photo updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || "Student",
          bio: bio.trim() || null,
          major: major.trim() || null,
          year: year.trim() || null,
          campus_id: campus?.id ?? null,
        })
        .eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["public-profile", user.id] });
      qc.invalidateQueries({ queryKey: ["profile-edit", user.id] });
      toast.success("Profile updated");
      navigate({ to: "/profile/$userId", params: { userId: user.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center gap-3">
          <Link
            to="/profile/$userId"
            params={{ userId: user.id }}
            aria-label="Back to profile"
            className="rounded-full p-2 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">Edit profile</h1>
        </div>

        {/* Avatar */}
        <div className="mt-8 flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="group relative h-28 w-28 overflow-hidden rounded-full border-2 border-gray-100 bg-muted shadow-sm dark:border-border"
            aria-label="Upload profile photo"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-3xl">🙂</span>
            )}
            <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-black/45 py-1.5 text-white">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <p className="mt-2 text-xs text-gray-400">{uploading ? "Uploading…" : "Tap to change photo"}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </div>

        {/* Fields */}
        <div className="mt-8 space-y-5">
          <Field label="Display name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-background px-3 py-2.5 text-sm outline-none focus:border-gray-900 dark:border-border dark:focus:border-foreground"
            />
          </Field>

          <Field label="Bio">
            <textarea
              rows={4}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              placeholder="A couple lines about you — major, what you're subletting, when you're around."
              className="w-full resize-none rounded-xl border border-gray-300 bg-background px-3 py-2.5 text-sm outline-none focus:border-gray-900 dark:border-border dark:focus:border-foreground"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{bio.length}/{BIO_MAX}</p>
          </Field>

          <Field label="Major">
            <input
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="e.g. Marketing"
              className="w-full rounded-xl border border-gray-300 bg-background px-3 py-2.5 text-sm outline-none focus:border-gray-900 dark:border-border dark:focus:border-foreground"
            />
          </Field>

          <Field label="Home campus">
            <div className="rounded-xl border border-border bg-background px-3 py-2.5">
              <CampusAutocomplete
                value={campus?.name ?? ""}
                placeholder="Search your school…"
                onSelect={setCampus}
                onClear={() => setCampus(null)}
              />
            </div>
          </Field>

          <Field label="Grad year">
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2026"
              className="w-full rounded-xl border border-gray-300 bg-background px-3 py-2.5 text-sm outline-none focus:border-gray-900 dark:border-border dark:focus:border-foreground"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-8 rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
