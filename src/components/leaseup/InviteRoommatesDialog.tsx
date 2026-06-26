import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function InviteRoommatesDialog({
  open,
  onOpenChange,
  referralCode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  referralCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const link = referralCode ? `https://leasup.co/join?ref=${referralCode}` : "https://leasup.co";

  function copy() {
    const text = `Just posted my place on LeaseUp — verified student subleases. Use my link: ${link}`;
    if ((navigator as any).share) {
      (navigator as any).share({ title: "LeaseUp", text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="text-center">
          <div className="text-5xl">✅</div>
          <h2 className="mt-2 text-2xl font-black">Your listing is live!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Know someone else subleasing?<br />
            Send them your invite link — verified students only.
          </p>

          <div className="mt-5 rounded-xl border bg-background px-3 py-2.5 text-sm font-mono truncate">
            {link.replace("https://", "")}
          </div>

          <button
            onClick={copy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            {copied ? <><Check className="h-4 w-4" />Copied!</> : <><Copy className="h-4 w-4" />Copy & Share</>}
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="mt-3 w-full text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
