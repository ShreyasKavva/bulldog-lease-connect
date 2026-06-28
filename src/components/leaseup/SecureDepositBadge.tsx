import { Lock } from "lucide-react";

export function SecureDepositBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold uppercase text-success">
        <Lock className="h-3 w-3" /> Deposit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-[11px] font-bold text-success">
      <Lock className="h-3 w-3" /> Secure Deposit
    </span>
  );
}

export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
      ⭐ Featured
    </span>
  );
}
