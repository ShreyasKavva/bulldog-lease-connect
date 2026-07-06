import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowLeft, Bell, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useNotificationsPage,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDeleteNotification,
  type Notification,
} from "@/hooks/use-notifications";
import { useSession } from "@/lib/leaseup/use-session";
import { notificationMeta } from "@/lib/leaseup/notification-meta";
import { SignInGate } from "@/components/leaseup/SignInGate";


export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — LeaseUp" },
      { name: "description", content: "Your LeaseUp activity, alerts, and messages in one place." },
    ],
  }),
  component: NotificationsPage,
});

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useNotificationsPage();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const del = useDeleteNotification();
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Signed-out visitors see a proper prompt instead of being kicked to /auth.


  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const all = (data?.pages.flat() ?? []) as Notification[];
  const unread = all.filter((n) => !n.read).length;

  if (loading) return <div className="min-h-[60vh]" />;
  if (!user) {
    return (
      <SignInGate
        title="Sign in to see your notifications"
        body="You need to sign in to view your LeaseUp activity."
        next="/notifications"
      />
    );
  }

  function handleOpen(n: Notification) {
    if (!n.read) markOne.mutate(n.id);
    if (!n.link) return;
    const [path, search] = n.link.split("?");
    navigate({ to: path || "/", search: search ? Object.fromEntries(new URLSearchParams(search)) : {} });
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-3">
        <Link to="/" className="rounded-full p-2 hover:bg-background" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-base font-extrabold">Notifications</h1>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            className="flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-bold text-primary-dark hover:bg-primary/20"
          >
            <Check className="h-3.5 w-3.5" />Mark all read
          </button>
        )}
      </header>

      <main className="mx-auto max-w-2xl">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="px-6 py-24 text-center">
            <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <div className="text-lg font-bold">You're all caught up 👋</div>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Notifications will appear here as students interact with your listings.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border bg-surface sm:mt-3 sm:overflow-hidden sm:rounded-2xl sm:shadow-card-md">
            {all.map((n) => (
              <Row key={n.id} n={n} onOpen={() => handleOpen(n)} onDismiss={() => del.mutate(n.id)} />
            ))}
          </ul>
        )}
        <div ref={sentinel} className="h-8" />
        {isFetchingNextPage && (
          <div className="py-3 text-center text-xs text-muted-foreground">Loading…</div>
        )}
      </main>
    </div>
  );
}

function Row({ n, onOpen, onDismiss }: { n: Notification; onOpen: () => void; onDismiss: () => void }) {
  const meta = notificationMeta(n.type);
  const Icon = meta.icon;
  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3.5 transition hover:bg-background",
        !n.read && "border-l-[3px] border-primary bg-primary-light/25",
      )}
    >
      <button onClick={onOpen} className="flex flex-1 items-start gap-3 text-left">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", meta.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm leading-snug", !n.read ? "font-bold" : "font-semibold")}>{n.title}</div>
          {n.body && <div className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2">{n.body}</div>}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{timeAgo(n.created_at)}</span>
            {n.link && <span className="font-semibold text-primary">View →</span>}
          </div>
        </div>
        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss"
        className="rounded-full p-1.5 text-muted-foreground opacity-60 transition hover:bg-background hover:opacity-100 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
