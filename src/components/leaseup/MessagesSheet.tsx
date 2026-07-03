/**
 * MessagesSheet — the chat UI. Slides in from the right; lists conversations
 * on the left, the open thread on the right (or full-screen on mobile).
 *
 * Realtime: subscribes to the `messages` table filtered by conversation_id
 * for the open thread, and to the conversation list for last-message
 * updates. Clean up the channel on unmount or you'll leak subscriptions
 * across opens.
 *
 * Message types: text | image | document. Attachments are uploaded to the
 * chat-attachments bucket; signChatAttachment() mints a short-lived signed
 * URL for display.
 *
 * Per-user conversation flags (pinned/muted/deleted) are stored as two
 * columns on `conversations` (pinned_by_p1 / pinned_by_p2, etc.) so we can
 * write with a single update regardless of which side you're on. See
 * setConversationFlag in queries.ts.
 *
 * ScamWarningBanner runs lightweight pattern detection on incoming text
 * (Venmo/CashApp asks, off-platform contact, "out of country") and surfaces
 * a banner inside the thread. It does NOT block messages.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/leaseup/haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  setConversationFlag,
  toggleMessageReaction,
  sendAttachmentMessage,
  signChatAttachment,
} from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Send, Star, Search, Paperclip, Image as ImageIcon, FileText,
  MoreVertical, Pin, BellOff, Bell, Trash2, Flag, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/leaseup/constants";
import { markConversationRead } from "@/hooks/use-unread";
import { LeaveReviewDialog } from "./LeaveReviewDialog";
import type { Conversation, Message, MessageReaction } from "@/lib/leaseup/types";
import { toast } from "sonner";
import { ScamWarningBanner } from "./ScamWarningBanner";

const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];

function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 text-foreground rounded px-0.5">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

function isPinned(c: Conversation, userId: string) {
  return c.participant_1_id === userId ? !!c.pinned_by_p1 : !!c.pinned_by_p2;
}
function isMuted(c: Conversation, userId: string) {
  return c.participant_1_id === userId ? !!c.muted_by_p1 : !!c.muted_by_p2;
}

export function MessagesSheet({
  open, onOpenChange, initialConversationId, initialDraft,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialConversationId?: string | null;
  /** Prefilled composer text — only applied when opening a conversation
   *  with no prior messages (i.e. the user just started it from a listing). */
  initialDraft?: string | null;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);
  const [search, setSearch] = useState("");
  const [actionsFor, setActionsFor] = useState<Conversation | null>(null);

  useEffect(() => { if (initialConversationId) setActiveId(initialConversationId); }, [initialConversationId]);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => fetchConversations(user!.id),
    enabled: !!user?.id && open,
  });

  const active = conversations?.find(c => c.id === activeId) ?? null;
  const { data: messages } = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => fetchMessages(activeId!),
    enabled: !!activeId,
  });

  const otherId = active && user ? (active.participant_1_id === user.id ? active.participant_2_id : active.participant_1_id) : null;
  const lastMsgAt = active?.last_message_at ? new Date(active.last_message_at).getTime() : 0;
  const quiet14 = lastMsgAt > 0 && Date.now() - lastMsgAt > 14 * 24 * 60 * 60 * 1000;
  const listingDone = !!active?.listing && (active.listing.status === "filled" || active.listing.is_active === false);
  const canReview = !!(active && otherId && (listingDone || quiet14));
  const [showReview, setShowReview] = useState(false);

  // Realtime: messages, reactions, typing in active conversation
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!activeId || !user?.id) return;
    markConversationRead(activeId, user.id).then(() => {
      qc.invalidateQueries({ queryKey: ["unread", user.id] });
      qc.invalidateQueries({ queryKey: ["messages", activeId] });
    });

    const msgCh = supabase.channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", activeId] });
          qc.invalidateQueries({ queryKey: ["conversations", user.id] });
          markConversationRead(activeId, user.id).then(() => qc.invalidateQueries({ queryKey: ["unread", user.id] }));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" },
        () => qc.invalidateQueries({ queryKey: ["messages", activeId] }))
      .subscribe();

    // Typing broadcast channel
    const typingCh = supabase.channel(`typing:${activeId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload) => {
        const p = payload.payload as { user_id: string; typing: boolean };
        if (p.user_id === user.id) return;
        if (p.typing) {
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 5000);
        } else {
          setOtherTyping(false);
        }
      })
      .subscribe();
    typingChannelRef.current = typingCh;

    return () => {
      supabase.removeChannel(msgCh);
      supabase.removeChannel(typingCh);
      typingChannelRef.current = null;
      setOtherTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeId, qc, user?.id]);

  // Realtime list updates
  useEffect(() => {
    if (!user?.id || !open) return;
    const channel = supabase.channel(`conv:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" },
        () => qc.invalidateQueries({ queryKey: ["conversations", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, open, qc]);

  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length, otherTyping]);

  // Prefill the composer with the initial draft the first time we open a
  // conversation that has no messages yet. Users can edit or clear it before
  // sending — this just kills the blank-page friction on brand-new threads.
  const draftAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeId || !initialDraft || !messages) return;
    if (messages.length > 0) return;
    if (draftAppliedRef.current === activeId) return;
    if (input.trim().length > 0) return;
    draftAppliedRef.current = activeId;
    setInput(initialDraft);
  }, [activeId, initialDraft, messages, input]);

  function broadcastTyping(typing: boolean) {
    if (!typingChannelRef.current || !user?.id) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, typing },
    });
  }

  async function send() {
    if (!input.trim() || !user || !active) return;
    const other = active.participant_1_id === user.id ? active.participant_2_id : active.participant_1_id;
    const text = input;
    setInput("");
    broadcastTyping(false);
    try {
      await sendMessage(active.id, user.id, other, text);
      haptic("light");
      qc.invalidateQueries({ queryKey: ["messages", active.id] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch (_e) { setInput(text); }
  }

  // Sorted + filtered conversations
  const sortedConversations = useMemo(() => {
    if (!conversations || !user?.id) return [];
    const list = [...conversations];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) => {
          const name = c.other?.name?.toLowerCase() ?? "";
          const title = c.listing?.title?.toLowerCase() ?? "";
          const last = c.last_message?.toLowerCase() ?? "";
          return name.includes(q) || title.includes(q) || last.includes(q);
        })
      : list;
    return filtered.sort((a, b) => {
      const pa = isPinned(a, user.id) ? 1 : 0;
      const pb = isPinned(b, user.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
  }, [conversations, search, user?.id]);

  // Attachment upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleAttachment(kind: "image" | "document", file: File | null) {
    if (!file || !active || !user || !otherId) return;
    setUploading(true);
    try {
      await sendAttachmentMessage(active.id, user.id, otherId, kind, file);
      qc.invalidateQueries({ queryKey: ["messages", active.id] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      setAttachMenuOpen(false);
    }
  }

  // Find index of most-recent sent message for "Seen"/"Delivered" receipt
  const lastSentIndex = useMemo(() => {
    if (!messages || !user?.id) return -1;
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === user.id) return i;
    return -1;
  }, [messages, user?.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full sm:max-w-md flex-col p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            {active && (
              <button onClick={() => setActiveId(null)} className="rounded-md p-1 hover:bg-background"><ArrowLeft className="h-4 w-4" /></button>
            )}
            <span className="flex-1 truncate">{active?.other ? active.other.name : "Messages"}</span>
            {active && (
              <button
                onClick={() => setActionsFor(active)}
                aria-label="Conversation actions"
                className="rounded-md p-1 hover:bg-background"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        {!active ? (
          <div className="flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 border-b bg-surface p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-full border bg-background py-2 pl-9 pr-9 text-sm outline-none focus:border-primary"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {sortedConversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {search ? "No conversations match." : 'No conversations yet. Tap "Message" on any listing.'}
              </div>
            ) : sortedConversations.map((c) => {
              const pinned = user?.id ? isPinned(c, user.id) : false;
              const muted = user?.id ? isMuted(c, user.id) : false;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  onContextMenu={(e) => { e.preventDefault(); setActionsFor(c); }}
                  className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-background"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-full text-lg" style={{ background: c.other?.banner_color ?? "#2563EB" }}>
                    {c.other?.avatar_emoji ?? "🙂"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {pinned && <Pin className="h-3 w-3 fill-primary text-primary" />}
                      <span className="truncate font-bold">{highlight(c.other?.name ?? "Student", search)}</span>
                      {muted && <BellOff className="h-3 w-3 text-muted-foreground" />}
                      {c.last_message_at && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{highlight(c.last_message ?? "Say hi 👋", search)}</div>
                    {c.listing && <div className="truncate text-[10px] text-primary mt-0.5">re: {highlight(c.listing.title, search)}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Listing context card */}
            {active.listing && (
              <div className="flex items-center gap-3 border-b bg-surface-2 px-3 py-2">
                {active.listing.photo_url ? (
                  <img src={active.listing.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">🏠</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{active.listing.title}</div>
                  {active.listing.is_active === false ? (
                    <div className="text-[11px] text-muted-foreground">This listing is no longer available</div>
                  ) : (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {active.listing.price ? `$${active.listing.price}/mo` : ""}
                      {active.listing.available_from && active.listing.available_to ? ` · ${active.listing.available_from} → ${active.listing.available_to}` : ""}
                    </div>
                  )}
                </div>
                {active.listing.is_active !== false && (
                  <button
                    onClick={() => { onOpenChange(false); window.location.href = `/listing/${active.listing!.id}`; }}
                    className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground"
                  >
                    View
                  </button>
                )}
              </div>
            )}

            {canReview && (
              <div className="flex items-center gap-2 border-b bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                <span className="flex-1">Has this sublease been sorted?</span>
                <button onClick={() => setShowReview(true)} className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-amber-950">
                  Leave a review →
                </button>
              </div>
            )}

            <ScamWarningBanner
              messages={messages as any}
              currentUserId={user?.id}
              conversationId={active.id}
            />


            <div className="flex-1 space-y-2 overflow-y-auto bg-background p-4">
              {messages?.map((m, idx) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  mine={m.sender_id === user?.id}
                  currentUserId={user?.id ?? ""}
                  isLastSentByMe={idx === lastSentIndex}
                  onReact={async (emoji) => {
                    if (!user?.id) return;
                    await toggleMessageReaction(m.id, user.id, emoji);
                    qc.invalidateQueries({ queryKey: ["messages", active.id] });
                  }}
                />
              ))}
              {otherTyping && <TypingBubble />}
              <div ref={endRef} />
            </div>

            <div className="border-t bg-surface p-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setAttachMenuOpen((v) => !v)}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                    aria-label="Attach"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  {attachMenuOpen && (
                    <div className="absolute bottom-12 left-0 z-50 w-44 overflow-hidden rounded-2xl border bg-surface shadow-card-lg">
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-background"
                      >
                        <ImageIcon className="h-4 w-4 text-primary" /> Photo
                      </button>
                      <button
                        onClick={() => docInputRef.current?.click()}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-background"
                      >
                        <FileText className="h-4 w-4 text-primary" /> Document (PDF)
                      </button>
                    </div>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAttachment("image", e.target.files?.[0] ?? null)}
                />
                <input
                  ref={docInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleAttachment("document", e.target.files?.[0] ?? null)}
                />
                <input
                  value={input}
                  onChange={(e) => { setInput(e.target.value); broadcastTyping(e.target.value.length > 0); }}
                  onFocus={() => { if (input.length > 0) broadcastTyping(true); }}
                  onBlur={() => broadcastTyping(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  placeholder={uploading ? "Uploading…" : "Message…"}
                  disabled={uploading}
                  className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || uploading}
                  className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>

      {/* Conversation actions sheet */}
      {actionsFor && user?.id && (
        <ConversationActionsSheet
          conv={actionsFor}
          userId={user.id}
          onClose={() => setActionsFor(null)}
          onDeleted={() => { if (actionsFor.id === activeId) setActiveId(null); qc.invalidateQueries({ queryKey: ["conversations", user.id] }); }}
          onAny={() => qc.invalidateQueries({ queryKey: ["conversations", user.id] })}
          otherId={actionsFor.participant_1_id === user.id ? actionsFor.participant_2_id : actionsFor.participant_1_id}
        />
      )}

      {active && otherId && active.other && (
        <LeaveReviewDialog
          open={showReview}
          onOpenChange={setShowReview}
          reviewedUserId={otherId}
          reviewedName={active.other.name || "this student"}
          listingId={active.listing_id ?? null}
          reviewerRole={user?.id && active.listing_id ? "subletter" : "subletter"}
        />
      )}
    </Sheet>
  );
}

// ===== Subcomponents =====

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl border bg-surface px-3 py-2.5">
        <span className="lu-typing-dot block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="lu-typing-dot block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="lu-typing-dot block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

function MessageBubble({
  m, mine, currentUserId, isLastSentByMe, onReact,
}: {
  m: Message;
  mine: boolean;
  currentUserId: string;
  isLastSentByMe: boolean;
  onReact: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (m.attachment_url) {
      signChatAttachment(m.attachment_url).then(setSignedUrl);
    }
  }, [m.attachment_url]);

  function startPress() {
    pressTimer.current = setTimeout(() => setPickerOpen(true), 400);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  // Aggregate reactions: emoji -> users
  const grouped = useMemo(() => {
    const map = new Map<string, MessageReaction[]>();
    (m.reactions ?? []).forEach((r) => {
      const arr = map.get(r.reaction) ?? [];
      arr.push(r);
      map.set(r.reaction, arr);
    });
    return Array.from(map.entries());
  }, [m.reactions]);

  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className={cn("flex", mine ? "justify-end" : "justify-start", "relative max-w-[78%]")}>
        {pickerOpen && (
          <div className={cn(
            "lu-reaction-bubble absolute z-30 flex gap-1 rounded-full border bg-surface px-2 py-1.5 shadow-card-lg",
            mine ? "right-0 -top-11" : "left-0 -top-11",
          )}>
            {REACTION_EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => { onReact(e); setPickerOpen(false); }}
                className="text-lg leading-none transition-transform hover:scale-125"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onContextMenu={(e) => { e.preventDefault(); setPickerOpen(true); }}
          onDoubleClick={() => onReact("❤️")}
          className={cn(
            "rounded-2xl text-sm break-words",
            mine ? "bg-primary text-primary-foreground" : "bg-surface border text-foreground",
            m.content_type === "image" ? "p-1" : "px-3 py-2",
          )}
        >
          {m.content_type === "image" && signedUrl ? (
            <button onClick={() => setFullscreen(true)} className="block">
              <img src={signedUrl} alt="" className="max-h-60 max-w-[240px] rounded-xl object-cover" />
            </button>
          ) : m.content_type === "document" ? (
            <a
              href={signedUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={cn("flex items-center gap-2 rounded-lg px-2 py-1", mine ? "text-primary-foreground" : "text-foreground")}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{m.attachment_name ?? "Document"}</span>
                <span className={cn("block text-[10px]", mine ? "opacity-80" : "text-muted-foreground")}>
                  {formatBytes(m.attachment_size)} · Tap to open
                </span>
              </span>
            </a>
          ) : (
            m.content
          )}
        </div>
      </div>

      {grouped.length > 0 && (
        <div className={cn("mt-0.5 flex gap-1", mine ? "justify-end pr-2" : "justify-start pl-2")}>
          {grouped.map(([emoji, users]) => {
            const meReacted = users.some((u) => u.user_id === currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "rounded-full border bg-surface px-1.5 py-0.5 text-[11px] shadow-sm transition",
                  meReacted ? "ring-1 ring-primary" : "",
                )}
              >
                {emoji} {users.length > 1 ? users.length : ""}
              </button>
            );
          })}
        </div>
      )}

      {mine && isLastSentByMe && (
        <div className="mt-0.5 pr-1 text-[11px] text-muted-foreground">
          {m.read_at ? "Seen" : "Delivered"}
        </div>
      )}

      {fullscreen && signedUrl && (
        <div
          onClick={() => setFullscreen(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4"
        >
          <img src={signedUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            onClick={() => setFullscreen(false)}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ConversationActionsSheet({
  conv, userId, onClose, onDeleted, onAny, otherId,
}: {
  conv: Conversation;
  userId: string;
  onClose: () => void;
  onDeleted: () => void;
  onAny: () => void;
  otherId: string;
}) {
  const pinned = isPinned(conv, userId);
  const muted = isMuted(conv, userId);

  async function run(flag: "pinned" | "muted" | "deleted", value: boolean) {
    try {
      await setConversationFlag(conv, userId, flag, value);
      if (flag === "deleted" && value) { onDeleted(); toast.success("Conversation hidden"); }
      else onAny();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    onClose();
  }

  async function report() {
    try {
      if (conv.listing_id) {
        const { fileReport } = await import("@/lib/leaseup/admin.queries");
        await fileReport(conv.listing_id, userId, "Reported from conversation", `Reported user: ${otherId}`);
        toast.success("Report submitted to moderators");
      } else {
        toast.message("Open the listing to file a detailed report.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to report");
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="lu-spring-in w-full max-w-md overflow-hidden rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-2">
          <ActionRow icon={<Pin className="h-5 w-5" />} label={pinned ? "Unpin conversation" : "Pin conversation"} onClick={() => run("pinned", !pinned)} />
          <ActionRow icon={muted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />} label={muted ? "Unmute notifications" : "Mute notifications"} onClick={() => run("muted", !muted)} />
          <ActionRow icon={<Trash2 className="h-5 w-5" />} label="Delete conversation" onClick={() => run("deleted", true)} destructive />
          <ActionRow icon={<Flag className="h-5 w-5" />} label="Report user" onClick={report} destructive />
        </div>
        <button onClick={onClose} className="w-full border-t py-3 text-sm font-semibold text-muted-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActionRow({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-background",
        destructive ? "text-red-600" : "text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
