import { Plus, MapPin } from "lucide-react";

export function MapEmptyState({
  campusName,
  onPost,
}: {
  campusName: string;
  onPost: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-surface/95 p-5 text-center shadow-card-lg backdrop-blur">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-light text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <h2 className="text-base font-extrabold">No listings yet at {campusName}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Be the first to post your sublease. Takes 2 minutes — it shows up on the map instantly.
        </p>
        <button
          onClick={onPost}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-card-md hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Post your place
        </button>
      </div>
    </div>
  );
}
