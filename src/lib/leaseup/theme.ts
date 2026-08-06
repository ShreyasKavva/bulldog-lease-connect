// Theme management for LeaseUp — light / dark / system
import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";
const STORAGE_KEY = "leaseup:theme";

function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

export function applyTheme(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0F1117" : "#111827");
}

export function getStoredTheme(): ThemePref {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "light";
}

export function setStoredTheme(pref: ThemePref) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    setPref(getStoredTheme());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return {
    theme: pref,
    setTheme: (p: ThemePref) => {
      setPref(p);
      setStoredTheme(p);
    },
  };
}
