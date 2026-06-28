import { AlertTriangle, X } from "lucide-react";
import { useMemo, useState } from "react";

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(venmo|cash\s?app|cashapp|zelle|wire\s?transfer|western\s?union|money\s?gram|moneygram|bitcoin|btc|crypto)\b/i, label: "off-platform payment" },
  { re: /\bsend\s+(me\s+)?(the\s+)?(money|funds|deposit|payment|cash|\$)/i, label: "request to send money" },
  { re: /\bi(?:'|\s+a)m\s+(currently\s+)?(out of the country|abroad|traveling|overseas)/i, label: "out-of-country claim" },
  { re: /\b(mail|ship|fedex|ups)\s+(you|the)\s+(keys|key)/i, label: "mailing keys" },
  { re: /(?:https?:\/\/|www\.)(?!(?:[\w-]+\.)*(?:leasup\.co|leaseup\.co|lovable\.app))/i, label: "external link" },
];

/**
 * Client-side scam screen for incoming messages.
 * Returns null if recipient is the current user and nothing is suspicious or it was dismissed.
 */
export function ScamWarningBanner({
  messages,
  currentUserId,
  conversationId,
  onReport,
}: {
  messages: { id: string; sender_id: string; content: string; content_type?: string }[] | undefined;
  currentUserId: string | undefined;
  conversationId: string;
  onReport?: () => void;
}) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const hit = useMemo(() => {
    if (!messages || !currentUserId) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id === currentUserId) continue;
      if ((m.content_type ?? "text") !== "text") continue;
      for (const p of PATTERNS) {
        if (p.re.test(m.content)) return { messageId: m.id, label: p.label };
      }
    }
    return null;
  }, [messages, currentUserId]);

  if (!hit) return null;
  const key = `${conversationId}:${hit.messageId}`;
  if (dismissed[key]) return null;

  return (
    <div className="flex items-start gap-2 border-b bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex-1">
        <div className="font-bold">⚠️ Scam warning</div>
        <div className="opacity-90">
          This message contains language commonly used in rental scams ({hit.label}). Never send money before
          visiting the property in person.
        </div>
        <div className="mt-1 flex gap-3">
          {onReport && (
            <button onClick={onReport} className="font-semibold underline">
              Report this message
            </button>
          )}
          <button
            onClick={() => setDismissed((d) => ({ ...d, [key]: true }))}
            className="font-semibold opacity-80 hover:opacity-100"
          >
            I understand — dismiss
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed((d) => ({ ...d, [key]: true }))}
        className="rounded-full p-1 hover:bg-amber-100 dark:hover:bg-amber-500/20"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
