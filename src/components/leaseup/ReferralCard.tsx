import { useState } from "react";
import { Gift, Copy, Check, ChevronDown } from "lucide-react";

export function ReferralCard({ referralCode, referralCount }: { referralCode: string | null; referralCount: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!referralCode) return null;
  const link = `https://leasup.co/join?ref=${referralCode}`;

  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <section className="mt-4 rounded-2xl bg-surface shadow-card-md overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Gift className="h-4 w-4 text-primary" /> Share LeaseUp
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="text-base font-extrabold">🎉 Invite your friends to LeaseUp</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Your referral link
          </div>
          <div className="mt-2 flex items-stretch gap-2">
            <div className="flex-1 truncate rounded-lg bg-background px-3 py-2 text-sm font-mono">
              leasup.co/join?ref={referralCode}
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
            >
              {copied ? <><Check className="h-4 w-4" />Copied!</> : <><Copy className="h-4 w-4" />Copy</>}
            </button>
          </div>
          <div className="mt-3 text-sm">
            You've referred <span className="font-extrabold text-primary">{referralCount}</span> {referralCount === 1 ? "student" : "students"}
          </div>
        </div>
      )}
    </section>
  );
}
