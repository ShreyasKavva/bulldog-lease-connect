import { useNavigate, Link } from "@tanstack/react-router";
import { Bell, Check, X, Activity as ActivityIcon, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDeleteNotification,
  type Notification,
} from "@/hooks/use-notifications";
import { useActivity, activityTimeAgo } from "@/lib/leaseup/activity";
import { useIsMobile } from "@/hooks/use-mobile";
import { notificationMeta } from "@/lib/leaseup/notification-meta";

import { useUnreadMessages, markMessagesRead } from "@/hooks/use-unread-messages";
import { useSession } from "@/lib/leaseup/use-session";
import { useQueryClient } from "@tanstack/react-query";

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

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-700",
];

function InitialAvatar({ name }: { name: string }) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold", AVATAR_TONES[hash % AVATAR_TONES.length])}>
      {initial}
    </div>
  );
}

export function NotificationsBell({ onOpenMessages }: { onOpenMessages?: () => void }) {
  const { data: notifications = [] } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const del = useDeleteNotification();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useSession();
  const qc = useQueryClient();
  const unreadMessages = useUnreadMessages();
  const [tab, setTab] = useState<"notifications" | "activity">("notifications");
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length + unreadMessages.length;

  // Q153 — opening the popover clears the message side of the badge.
  useEffect(() => {
    if (!open || !user?.id || unreadMessages.length === 0) return;
    const ids = unreadMessages.map((m) => m.id);
    const t = setTimeout(() => {
      markMessagesRead(ids, user.id).then(() => {
        qc.invalidateQueries({ queryKey: ["unread-messages", user.id] });
        qc.invalidateQueries({ queryKey: ["unread", user.id] });
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [open, user?.id, unreadMessages, qc]);

  // Pulse badge briefly when unread count grows
  const prevUnread = useRef(unread);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (unread > prevUnread.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 320);
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);


  function handleClick(n: Notification) {
    if (!n.read) markOne.mutate(n.id);
    setOpen(false);
    const isMessage = n.type === "new_message" || n.type === "message";
    if (isMessage && onOpenMessages) {
      onOpenMessages();
      return;
    }
    if (n.link) {
      const [path, search] = n.link.split("?");
      navigate({ to: path || "/", search: search ? Object.fromEntries(new URLSearchParams(search)) : {} });
    }
  }

  const trigger = (
    <button
      aria-label="Notifications"
      className="relative rounded-full bg-background p-2 hover:bg-border"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span
          aria-label={`${unread} unread notifications`}
          className={cn(
            "absolute right-1 top-1 h-2 w-2 rounded-full bg-[#FF5A5F]",
            pulse && "lu-badge-pulse",
          )}
        />
      )}
    </button>
  );

  // On mobile: clicking the bell goes to the full /notifications page.
  if (isMobile) {
    return (
      <Link to="/notifications" aria-label="Notifications" className="relative inline-block">
        {trigger}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b">
          <div className="flex">
            <TabButton active={tab === "notifications"} onClick={() => setTab("notifications")}>
              Notifications {unread > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </TabButton>
            <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
              <ActivityIcon className="mr-1 inline h-3.5 w-3.5" />Activity
            </TabButton>
          </div>
          {tab === "notifications" && unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="mr-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Check className="h-3 w-3" />Mark all read
            </button>
          )}
        </div>

        {tab === "notifications" ? (
          <ScrollArea className="max-h-[480px]">
            {unreadMessages.length === 0 && notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="divide-y">
                {/* Q153 — unread messages first */}
                {unreadMessages.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        setOpen(false);
                        if (onOpenMessages) onOpenMessages();
                        else navigate({ to: "/messages" });
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-background"
                    >
                      <InitialAvatar name={m.senderName} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold leading-tight">
                          💬 {m.senderName} sent you a message
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {timeAgo(m.created_at)} ago
                        </div>
                      </div>
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    </button>
                  </li>
                ))}
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onClick={() => handleClick(n)}
                    onDismiss={() => del.mutate(n.id)}
                  />
                ))}
              </ul>
            )}
            <div className="border-t p-2">
              <Link
                to="/messages"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 rounded-md py-2 text-xs font-bold text-primary hover:bg-background"
              >
                See all messages <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 rounded-md py-2 text-xs font-bold text-primary hover:bg-background"
              >
                See all notifications <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </ScrollArea>

        ) : (
          <ActivityTab />
        )}
      </PopoverContent>
    </Popover>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      <Bell className="mx-auto mb-3 h-8 w-8 opacity-40" />
      <div className="font-semibold text-foreground">🔕 No new notifications</div>
      <div className="mt-1 text-xs">Notifications will appear here as students interact with your listings.</div>
    </div>
  );
}


function NotificationRow({
  n,
  onClick,
  onDismiss,
}: {
  n: Notification;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const meta = notificationMeta(n.type);
  const Icon = meta.icon;
  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 hover:bg-background transition",
        !n.read && "border-l-[3px] border-primary bg-primary-light/30",
      )}
    >
      <button onClick={onClick} className="flex flex-1 items-start gap-3 text-left">
        <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", meta.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm leading-tight", !n.read ? "font-bold" : "font-semibold")}>{n.title}</div>
          {n.body && (
            <div className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2">{n.body}</div>
          )}
          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {timeAgo(n.created_at)} ago
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
        className="opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      </button>
    </li>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-4 py-2.5 text-sm font-bold transition",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
    </button>
  );
}

function ActivityTab() {
  const { data: items = [], isLoading } = useActivity();
  return (
    <>
      <ScrollArea className="max-h-[380px]">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-background" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <ActivityIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No activity yet.
          </div>
        ) : (
          <ul className="divide-y">
            {items.slice(0, 12).map((it) => (
              <li key={it.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="text-lg leading-none">{it.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-snug">{it.text}</div>
                  <div className="text-[10px] text-muted-foreground">{activityTimeAgo(it.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
      <div className="border-t p-2">
        <Link
          to="/activity"
          className="flex items-center justify-center gap-1 rounded-md py-2 text-xs font-bold text-primary hover:bg-background"
        >
          See full activity feed <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </>
  );
}
