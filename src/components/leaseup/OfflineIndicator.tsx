import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [state, setState] = useState<"online" | "offline" | "restored">("online");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setState(navigator.onLine ? "online" : "offline");
    const onOff = () => setState("offline");
    const onOn = () => {
      setState("restored");
      setTimeout(() => setState("online"), 2000);
    };
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  if (state === "online") return null;
  const isRestored = state === "restored";
  return (
    <div
      role="status"
      className={`fixed left-0 right-0 top-0 z-[9999] px-3 py-1.5 text-center text-xs font-semibold text-white transition-opacity ${
        isRestored ? "bg-emerald-600" : "bg-red-600"
      }`}
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}
    >
      {isRestored ? "✓ Back online" : "● No internet connection — some features may not work"}
    </div>
  );
}
