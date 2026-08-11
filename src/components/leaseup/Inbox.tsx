/**
 * Q94 — Real messaging inbox.
 *
 * Two-column on desktop (conversation list 35% · thread 65%), single column on
 * mobile where selecting a thread pushes it full-screen. Built on the existing
 * conversations/messages tables (participant_1_id / participant_2_id, content,
 * read_at) — no schema change needed.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, Home, MessageCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchConversations, fetchMessages, sendMessage } from "@/lib/leaseup/queries";

/** Q154 — one-tap conversation openers shown while the composer is empty. */
const QUICK_REPLIES = [
  "Is this still available?",
  "Can I schedule a viewing?",
  "What's included?",
] as const;
import { markConversationRead } from "@/hooks/use-unread";
import { cn } from "@/lib/utils";
import type { Conversation, Message } from "@/lib/leaseup/types";

function relTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayName(c: Conversation) {
  return c.other?.name?.trim() || "Unknown user";
}

function Avatar({ c, size = 40 }: { c: Conversation; size?: number }) {
  const bg = c.other?.banner_color ?? "#2563EB";
  const char = c.other?.avatar_emoji ?? (c.other?.name?.[0]?.toUpperCase() ?? "?");
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-base text-white"
      style={{ background: bg, width: size, height: size }}
      aria-hidden
    >
      {char}
    </span>
  );
}

export function Inbox({ conversationId }: { conversationId?: string | null }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => fetchConversations(user!.id),
    enabled: !!user?.id,
  });

  const active = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  // Live conversation-list refresh (any message touching me).
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`inbox:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  return (
    <div className="mx-auto max-w-7xl px-0 md:px-6 lg:px-10">
      <div className="flex min-h-[calc(100vh-3.5rem)] md:gap-6 md:py-6">
        {/* Conversation list */}
        <aside
          className={cn(
            "w-full md:w-[35%] md:shrink-0 md:rounded-2xl md:border md:border-gray-200 md:bg-white dark:md:border-border dark:md:bg-surface",
            conversationId && "hidden md:block",
          )}
        >
          <h1 className="px-4 pb-2 pt-5 text-2xl font-bold tracking-tight md:text-xl">Messages</h1>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-300" strokeWidth={1.5} />
              <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-foreground">No messages yet</h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
                When you message a host or someone messages you, it'll show up here.
              </p>
              <Link
                to="/browse"
                className="mt-4 inline-block rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
              >
                Browse subleases →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-border">
              {conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  c={c}
                  meId={user!.id}
                  active={c.id === conversationId}
                  onOpen={() => navigate({ to: "/messages/$conversationId", params: { conversationId: c.id } })}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* Thread */}
        <section
          className={cn(
            "w-full md:w-[65%] md:rounded-2xl md:border md:border-gray-200 md:bg-white dark:md:border-border dark:md:bg-surface",
            !conversationId && "hidden md:block",
          )}
        >
          {conversationId ? (
            <Thread key={conversationId} conversationId={conversationId} conv={active} />
          ) : (
            <div className="hidden h-full min-h-[50vh] place-items-center text-sm text-gray-500 md:grid">
              Select a conversation
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationRow({
  c, meId, active, onOpen,
}: { c: Conversation; meId: string; active: boolean; onOpen: () => void }) {
  // Q108 — unread count + last sender arrive with the conversation list.
  const unread = c.unread_count ?? 0;
  const isUnread = unread > 0 && !active;
  const mine = !!c.last_message_sender_id && c.last_message_sender_id === meId;
  const preview = c.last_message
    ? `${mine ? "You: " : ""}${c.last_message}`
    : "No messages yet";

  return (
    <li>
      <button
        onClick={onOpen}
        className={cn(
          "relative flex w-full items-center gap-3 px-4 py-3 text-left transition active:scale-[0.99]",
          active ? "bg-gray-100 dark:bg-white/10" : "hover:bg-gray-50 dark:hover:bg-white/5",
        )}
      >
        {c.listing?.photo_url ? (
          <img
            src={c.listing.photo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        ) : c.listing ? (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gray-100 dark:bg-white/10">
            <Home className="h-5 w-5 text-gray-400" />
          </span>
        ) : (
          <Avatar c={c} size={48} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", isUnread ? "font-bold" : "font-semibold")}>
              {displayName(c)}
            </span>
            <span className="shrink-0 text-xs text-gray-400">{relTime(c.last_message_at)}</span>
          </span>
          {c.listing?.title && (
            <span className="block truncate text-xs text-gray-400">{c.listing.title}</span>
          )}
          <span
            className={cn(
              "block truncate text-sm",
              isUnread ? "font-medium text-gray-900 dark:text-foreground" : "text-gray-500 dark:text-foreground/60",
            )}
          >
            {preview}
          </span>
        </span>
        {isUnread && (
          <span className="ml-1 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#FF5A5F] px-1.5 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </li>
  );
}


function Thread({ conversationId, conv }: { conversationId: string; conv: Conversation | null }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Q104 — a page can hand off a suggested opener (e.g. "ask about roommates").
  // Consumed once, then cleared so it never reappears on a later thread.
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem("leaseup-msg-draft");
      if (draft) {
        sessionStorage.removeItem("leaseup-msg-draft");
        setText((t) => (t ? t : draft));
      }
    } catch { /* noop */ }
    // Q106 — focus the composer when a thread is opened (deep-link or click).
    const t = setTimeout(() => {
      taRef.current?.focus();
      bottomRef.current?.scrollIntoView({ block: "end" });
    }, 60);
    return () => clearTimeout(t);
  }, [conversationId]);

  const { data: serverMessages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: !!conversationId,
  });

  // Q105 — optimistic sends: the bubble shows instantly, then the row from the
  // server replaces it (matched on body + sender) once the query refetches.
  const [pending, setPending] = useState<Message[]>([]);
  useEffect(() => { setPending([]); }, [conversationId]);
  const messages = useMemo(() => {
    const live = pending.filter(
      (p) => !serverMessages.some((m) => m.sender_id === p.sender_id && m.content === p.content),
    );
    return [...serverMessages, ...live];
  }, [serverMessages, pending]);
  useEffect(() => {
    setPending((prev) =>
      prev.filter((p) => !serverMessages.some((m) => m.sender_id === p.sender_id && m.content === p.content)),
    );
  }, [serverMessages]);


  // Realtime: new messages in this thread
  useEffect(() => {
    const ch = supabase
      .channel(`thread:${conversationId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  // Mark received messages read on open / on new arrivals
  useEffect(() => {
    if (!user?.id) return;
    if (!messages.some((m) => m.recipient_id === user.id && !m.read_at)) return;
    markConversationRead(conversationId, user.id).then(() => {
      qc.invalidateQueries({ queryKey: ["unread", user.id] });
      qc.invalidateQueries({ queryKey: ["conv-unread", conversationId, user.id] });
    });
  }, [messages, conversationId, user?.id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  const otherId = conv
    ? conv.participant_1_id === user?.id ? conv.participant_2_id : conv.participant_1_id
    : null;

  async function handleSend() {
    const body = text.trim();
    if (!body || !user?.id || !otherId || sending) return;
    setSending(true);
    setText("");
    const optimistic = {
      id: `pending-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: user.id,
      recipient_id: otherId,
      content: body,
      created_at: new Date().toISOString(),
      read_at: null,
    } as unknown as Message;
    setPending((p) => [...p, optimistic]);
    try {
      await sendMessage(conversationId, user.id, otherId, body, conv?.listing_id ?? null);
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch {
      setPending((p) => p.filter((m) => m.id !== optimistic.id));
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-7rem)]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 dark:border-border">
        <button
          onClick={() => navigate({ to: "/messages" })}
          aria-label="Back to inbox"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100 md:hidden dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conv && <Avatar c={conv} size={36} />}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{conv ? displayName(conv) : "Conversation"}</div>
          {/* Q157 — quick jump back to the listing being discussed */}
          {conv?.listing?.id && (
            <Link
              to="/listing/$id"
              params={{ id: conv.listing.id }}
              className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {conv.listing.photo_url ? (
                <img src={conv.listing.photo_url} alt="" className="inline-block h-6 w-6 rounded object-cover" loading="lazy" />
              ) : (
                <span aria-hidden>🏠</span>
              )}
              <span className="truncate">{conv.listing.title}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </header>

      {/* Q107 — listing context strip */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 dark:border-border dark:bg-surface">
        {conv?.listing?.id ? (
          <>
            {conv.listing.photo_url ? (
              <img
                src={conv.listing.photo_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gray-100 dark:bg-white/10">
                <Home className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-foreground">
                {conv.listing.title}
              </div>
              <div className="truncate text-xs text-gray-500">
                {[
                  conv.listing.price != null ? `$${conv.listing.price}/mo` : null,
                  conv.listing.beds != null ? `${conv.listing.beds || "Studio"}${conv.listing.beds ? "BR" : ""}` : null,
                  conv.listing.area || null,
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
            <Link
              to="/listing/$id"
              params={{ id: conv.listing.id }}
              className="shrink-0 text-xs text-[#FF5A5F] hover:underline"
            >
              View listing →
            </Link>
          </>
        ) : (
          <>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gray-100 dark:bg-white/10">
              <MessageCircle className="h-5 w-5 text-gray-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-foreground">General inquiry</div>
              <div className="truncate text-xs text-gray-500">Not about a specific listing</div>
            </div>
          </>
        )}
      </div>


      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">
            Say hi 👋 — messaging on LeaseUp is always free.
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble key={m.id} m={m} mine={m.sender_id === user?.id} grouped={messages[i - 1]?.sender_id === m.sender_id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="sticky bottom-0 border-t border-gray-100 bg-white px-3 py-3 dark:border-border dark:bg-surface"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Write a message…"
            className="max-h-24 flex-1 resize-none rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none ring-0 focus:border-gray-900 dark:border-border dark:bg-background dark:focus:border-white"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-900 text-white disabled:opacity-40 dark:bg-white dark:text-gray-900"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>

        {/* Q154 — one-tap openers; they disappear as soon as the student types */}
        {text.trim().length === 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setText(q);
                  taRef.current?.focus();
                }}
                className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-200 dark:border-border dark:bg-background dark:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function Bubble({ m, mine, grouped }: { m: Message; mine: boolean; grouped: boolean }) {
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start", grouped ? "mt-0.5" : "mt-3")}>
      <div
        className={cn(
          "max-w-[75%] whitespace-pre-wrap break-words px-4 py-2 text-sm rounded-2xl",
          mine
            ? "rounded-br-sm bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-foreground",
        )}
      >
        {m.content}
      </div>
      <span className="mt-0.5 text-xs text-gray-400">
        {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );
}
