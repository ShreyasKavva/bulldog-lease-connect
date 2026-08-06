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
import { ArrowLeft, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchConversations, fetchMessages, sendMessage } from "@/lib/leaseup/queries";
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
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <span className="text-4xl">📭</span>
              <p className="font-medium text-gray-600 dark:text-foreground/70">No messages yet</p>
              <Link to="/browse" className="text-sm font-medium underline">Browse subleases</Link>
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
  const { data: unread = 0 } = useQuery({
    queryKey: ["conv-unread", c.id, meId],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("recipient_id", meId)
        .is("read_at", null);
      return count ?? 0;
    },
  });
  const isUnread = unread > 0 && !active;

  return (
    <li>
      <button
        onClick={onOpen}
        className={cn(
          "relative flex w-full items-center gap-3 px-4 py-3 text-left transition active:scale-[0.99]",
          active ? "bg-gray-100 dark:bg-white/10" : isUnread ? "bg-gray-50 dark:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-white/5",
        )}
      >
        {isUnread && <span className="absolute left-1 h-1.5 w-1.5 rounded-full bg-[#FF5A5F]" />}
        <Avatar c={c} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", isUnread ? "font-bold" : "font-semibold")}>
              {displayName(c)}
            </span>
            <span className="shrink-0 text-xs text-gray-400">{relTime(c.last_message_at)}</span>
          </span>
          {c.listing?.title && (
            <span className="block truncate text-sm text-gray-500">{c.listing.title}</span>
          )}
          <span className="block truncate text-sm text-gray-500 dark:text-foreground/60">
            {c.last_message ?? "No messages yet"}
          </span>
        </span>
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
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const otherId = conv
    ? conv.participant_1_id === user?.id ? conv.participant_2_id : conv.participant_1_id
    : null;

  async function handleSend() {
    const body = text.trim();
    if (!body || !user?.id || !otherId || sending) return;
    setSending(true);
    setText("");
    try {
      await sendMessage(conversationId, user.id, otherId, body, conv?.listing_id ?? null);
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch {
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
          {conv?.listing?.id && (
            <Link
              to="/listing/$id"
              params={{ id: conv.listing.id }}
              className="block truncate text-sm text-gray-500 hover:underline"
            >
              about {conv.listing.title}
            </Link>
          )}
        </div>
      </header>

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
        className="sticky bottom-0 flex items-end gap-2 border-t border-gray-100 bg-white px-3 py-3 dark:border-border dark:bg-surface"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
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
