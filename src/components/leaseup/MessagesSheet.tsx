import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchConversations, fetchMessages, sendMessage } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/leaseup/constants";
import { markConversationRead } from "@/hooks/use-unread";
import { LeaveReviewDialog } from "./LeaveReviewDialog";

export function MessagesSheet({
  open, onOpenChange, initialConversationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialConversationId?: string | null;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);

  useEffect(() => { if (initialConversationId) setActiveId(initialConversationId); }, [initialConversationId]);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => fetchConversations(user!.id),
    enabled: !!user?.id && open,
  });

  const active = conversations?.find(c => c.id === activeId);
  const { data: messages } = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => fetchMessages(activeId!),
    enabled: !!activeId,
  });

  // Look up listing status to decide whether to show the review CTA.
  const { data: activeListing } = useQuery({
    queryKey: ["conv-listing", active?.listing_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id,title,status,is_active")
        .eq("id", active!.listing_id!)
        .maybeSingle();
      return data as { id: string; title: string; status: string | null; is_active: boolean } | null;
    },
    enabled: !!active?.listing_id,
  });
  const otherId = active && user ? (active.participant_1_id === user.id ? active.participant_2_id : active.participant_1_id) : null;
  const lastMsgAt = active?.last_message_at ? new Date(active.last_message_at).getTime() : 0;
  const quiet14 = lastMsgAt > 0 && Date.now() - lastMsgAt > 14 * 24 * 60 * 60 * 1000;
  const listingDone = !!activeListing && (activeListing.status === "filled" || activeListing.is_active === false);
  const canReview = !!(active && otherId && (listingDone || quiet14));
  const [showReview, setShowReview] = useState(false);


  // Realtime subscription for messages in active conversation
  useEffect(() => {
    if (!activeId) return;
    if (user?.id) markConversationRead(activeId, user.id).then(() => qc.invalidateQueries({ queryKey: ["unread", user.id] }));
    const channel = supabase.channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", activeId] });
          qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
          if (user?.id) markConversationRead(activeId, user.id).then(() => qc.invalidateQueries({ queryKey: ["unread", user.id] }));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, qc, user?.id]);

  // Realtime for conversation list
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
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length]);

  async function send() {
    if (!input.trim() || !user || !active) return;
    const other = active.participant_1_id === user.id ? active.participant_2_id : active.participant_1_id;
    const text = input;
    setInput("");
    try {
      await sendMessage(active.id, user.id, other, text);
      qc.invalidateQueries({ queryKey: ["messages", active.id] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch (e: any) { setInput(text); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full sm:max-w-md flex-col p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            {active && (
              <button onClick={() => setActiveId(null)} className="rounded-md p-1 hover:bg-background"><ArrowLeft className="h-4 w-4" /></button>
            )}
            {active?.other ? active.other.name : "Messages"}
          </SheetTitle>
        </SheetHeader>

        {!active ? (
          <div className="flex-1 overflow-y-auto">
            {(conversations?.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No conversations yet. Tap "Message" on any listing.
              </div>
            ) : conversations!.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-background">
                <div className="grid h-11 w-11 place-items-center rounded-full text-lg" style={{ background: c.other?.banner_color ?? "#2563EB" }}>
                  {c.other?.avatar_emoji ?? "🙂"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-bold">{c.other?.name ?? "Student"}</span>
                    {c.last_message_at && <span className="text-[10px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{c.last_message ?? "Say hi 👋"}</div>
                  {c.listing && <div className="truncate text-[10px] text-primary mt-0.5">re: {c.listing.title}</div>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            {canReview && (
              <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                <span className="flex-1">Has this sublease been sorted?</span>
                <button onClick={() => setShowReview(true)} className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-amber-950">
                  Leave a review →
                </button>
              </div>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto bg-background p-4">
              {messages?.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                      mine ? "bg-primary text-primary-foreground" : "bg-surface border")}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t p-3 flex gap-2 bg-surface">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Message…"
                className="flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-primary" />
              <button onClick={send} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary-dark">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </SheetContent>
      {active && otherId && active.other && (
        <LeaveReviewDialog
          open={showReview}
          onOpenChange={setShowReview}
          reviewedUserId={otherId}
          reviewedName={active.other.name || "this student"}
          listingId={active.listing_id ?? null}
          reviewerRole={user?.id && activeListing && active.listing_id ? "subletter" : "subletter"}
        />
      )}
    </Sheet>
  );
}
