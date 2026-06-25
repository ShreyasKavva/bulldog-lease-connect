import { useNavigate } from "@tanstack/react-router";
import { Bell, MessageSquare, TrendingDown, Sparkles, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDeleteNotification,
  type Notification,
} from "@/hooks/use-notifications";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(type: string) {
  if (type === "message") return <MessageSquare className="h-4 w-4 text-primary" />;
  if (type === "price_drop") return <TrendingDown className="h-4 w-4 text-emerald-600" />;
  if (type === "looking_for_match") return <Sparkles className="h-4 w-4 text-amber-500" />;
  return <Bell className="h-4 w-4 text-muted-foreground" />;
}

export function NotificationsBell({ onOpenMessages }: { onOpenMessages?: () => void }) {
  const { data: notifications = [] } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const del = useDeleteNotification();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  function handleClick(n: Notification) {
    if (!n.read) markOne.mutate(n.id);
    if (n.type === "message" && onOpenMessages) {
      onOpenMessages();
      return;
    }
    if (n.link) {
      // Use simple navigation; links are like /?listing=xxx
      const [path, search] = n.link.split("?");
      navigate({ to: path || "/", search: search ? Object.fromEntries(new URLSearchParams(search)) : {} });
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-full bg-background p-2 hover:bg-border"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="font-bold">Notifications</div>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6 opacity-50" />
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`group relative flex items-start gap-3 px-4 py-3 hover:bg-background ${
                    !n.read ? "bg-primary-light/40" : ""
                  }`}
                >
                  <button
                    onClick={() => handleClick(n)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <div className="mt-0.5">{iconFor(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold leading-tight">{n.title}</div>
                      {n.body && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                      )}
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {timeAgo(n.created_at)} ago
                      </div>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(n.id);
                    }}
                    aria-label="Dismiss"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
