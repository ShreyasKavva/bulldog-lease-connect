/**
 * Airbnb-style top header.
 *
 * Desktop (md+): wordmark · compact search pill (non-home only) ·
 *   Subleases · Roommates · Post a sublease · Sign In / Avatar-menu.
 * Mobile: wordmark + Post pill. Auth and profile live in the bottom nav.
 *
 * "Sign In" opens the <SignInModal/> — it does NOT navigate to /auth.
 * Any component can trigger the modal via `openSignIn(next?)`.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin, Calendar, Users, Search, Menu, X } from "lucide-react";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchSavedIds } from "@/lib/leaseup/queries";
import { NotificationsBell } from "@/components/leaseup/NotificationsBell";
import { NavSearchBar } from "@/components/leaseup/NavSearchBar";
import { SignInModal } from "@/components/leaseup/SignInModal";
import { useUnreadCount } from "@/hooks/use-unread";

type LegacyProps = { onOpenMessages?: () => void; transparent?: boolean };

export function TopBar(_legacy: LegacyProps = {}) {
  const { user } = useSession();
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });
  const { data: profile } = useMyProfile();
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isHome = path === "/";

  // Homepage: transparent over the hero, solid white after ~80px of scroll.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!isHome) { setScrolled(true); return; }
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const [signInOpen, setSignInOpen] = useState(false);
  const [signInNext, setSignInNext] = useState<string | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Global event bus so "Sign in to X" prompts from anywhere open this modal.
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ next?: string }>).detail;
      setSignInNext(detail?.next);
      setSignInOpen(true);
    }
    window.addEventListener("lu:open-signin", onOpen as EventListener);
    return () => window.removeEventListener("lu:open-signin", onOpen as EventListener);
  }, []);

  // Close avatar menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // Close menus on Escape.
  useEffect(() => {
    if (!menuOpen && !mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setMenuOpen(false); setMobileOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, mobileOpen]);

  // Close the mobile menu on outside click.
  useEffect(() => {
    if (!mobileOpen) return;
    function onDown(e: MouseEvent) {
      if (!mobileRef.current?.contains(e.target as Node)) setMobileOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mobileOpen]);



  function handlePost(e: React.MouseEvent) {
    e.preventDefault();
    if (user) navigate({ to: "/post" });
    else { setSignInNext("/post"); setSignInOpen(true); }
  }

  function openSignIn() {
    setSignInNext(undefined);
    setSignInOpen(true);
  }

  async function signOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const avatarBg = profile?.banner_color ?? "#2563EB";
  const avatarChar = profile?.avatar_emoji ?? "🙂";

  return (
    <>
      <header
        className={
          "sticky top-0 z-40 transition-all duration-200 " +
          (isHome && !scrolled
            ? "bg-transparent"
            : "border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-sm dark:border-border dark:bg-surface/95")
        }
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6 sm:px-10 lg:px-20">
          <Link to="/" className="text-xl font-bold tracking-tight text-gray-900 shrink-0 dark:text-foreground">LeaseUp</Link>

          {/* Center: functional compact search bar on non-home routes */}
          {!isHome && <NavSearchBar />}

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Desktop text links */}
            <Link
              to="/browse"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 md:inline-flex dark:text-foreground/80 dark:hover:text-foreground"
            >Subleases</Link>
            <Link
              to="/looking"
              className="hidden rounded-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 md:inline-flex dark:text-foreground/70 dark:hover:text-foreground"
            >Looking for a place?</Link>
            {user && (
              <Link
                to="/saved"
                className="relative hidden rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 md:inline-flex dark:text-foreground/80 dark:hover:text-foreground"
              >
                Saved
                {savedIds.size > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FF5A5F]" />
                )}
              </Link>
            )}

            {user && (
              <Link
                to="/messages"
                className="relative hidden rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 md:inline-flex dark:text-foreground/80 dark:hover:text-foreground"
              >
                Messages
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF5A5F] text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            )}




            <button
              onClick={handlePost}
              className="hidden items-center gap-1 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black md:inline-flex dark:bg-white dark:text-gray-900"
            >Post a sublease →</button>

            {/* Mobile Post pill (kept from previous minimal header) */}
            <button
              onClick={handlePost}
              className="hidden items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white sm:inline-flex md:hidden dark:bg-white dark:text-gray-900"
            >Post</button>

            {/* Q105 — mobile hamburger menu */}
            <div ref={mobileRef} className="relative md:hidden">
              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white dark:border-border dark:bg-background"
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              {mobileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-gray-100 bg-white py-2 shadow-xl dark:border-border dark:bg-surface">
                  <MenuItem to="/browse" onClick={() => setMobileOpen(false)}>Subleases</MenuItem>
                  <MenuItem to="/looking" onClick={() => setMobileOpen(false)}>Looking for a place?</MenuItem>

                  <div className="my-1 border-t border-gray-100 dark:border-border" />
                  <div className="px-3 pb-1 pt-1">
                    <button
                      onClick={(e) => { setMobileOpen(false); handlePost(e); }}
                      className="w-full rounded-full bg-gray-900 px-4 py-2 text-center text-sm font-semibold text-white dark:bg-white dark:text-gray-900"
                    >Post a sublease →</button>
                  </div>
                  <div className="my-1 border-t border-gray-100 dark:border-border" />

                  {user ? (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2">
                        <span
                          className="grid h-8 w-8 place-items-center rounded-full text-sm"
                          style={{ background: avatarBg }}
                        >{avatarChar}</span>
                        <span className="truncate text-sm font-semibold">
                          {profile?.name ?? user.email}
                        </span>
                      </div>
                      <MenuItem to="/profile" onClick={() => setMobileOpen(false)}>Profile</MenuItem>
                      <Link
                        to="/messages"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-background dark:text-foreground/80"
                      >
                        Messages
                        {unread > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF5A5F] text-[10px] font-bold text-white">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </Link>
                      <MenuItem to="/my-listings" onClick={() => setMobileOpen(false)}>My Listings</MenuItem>
                      <MenuItem to="/saved" onClick={() => setMobileOpen(false)}>Saved</MenuItem>
                      <button
                        onClick={() => { setMobileOpen(false); signOut(); }}
                        className="mt-1 w-full px-4 py-2 text-left text-sm font-medium text-red-600"
                      >Sign Out</button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setMobileOpen(false); openSignIn(); }}
                      className="mt-1 w-full px-4 py-2 text-left text-sm font-medium"
                    >Sign In</button>
                  )}
                </div>
              )}
            </div>


            {user ? (
              <>
                <div>
                  <NotificationsBell onOpenMessages={() => navigate({ to: "/messages" as any }).catch(() => {})} />
                </div>
                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 pr-2 shadow-sm hover:shadow dark:border-border dark:bg-background"
                    aria-label="Account menu"
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-base"
                      style={{ background: avatarBg }}
                    >{avatarChar}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-gray-100 bg-white py-2 shadow-xl dark:border-border dark:bg-surface">
                      <div className="px-4 pb-2">
                        <div className="truncate text-sm font-semibold">{profile?.name ?? "You"}</div>
                        <div className="truncate text-xs text-gray-500">{profile?.email ?? ""}</div>
                      </div>
                      <div className="my-1 h-px bg-gray-100 dark:bg-border" />
                      <MenuItem to="/my-listings" onClick={() => setMenuOpen(false)}>My Listings</MenuItem>
                      <MenuItem to="/saved" onClick={() => setMenuOpen(false)}>Saved</MenuItem>
                      <MenuItem to="/messages" onClick={() => setMenuOpen(false)}>Messages</MenuItem>
                      <MenuItem to="/profile" onClick={() => setMenuOpen(false)}>Profile</MenuItem>
                      <div className="my-1 h-px bg-gray-100 dark:bg-border" />
                      <button
                        onClick={signOut}
                        className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >Sign Out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={openSignIn}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-background dark:border-border"
              >Sign In</button>
            )}
          </div>
        </div>
      </header>

      <SignInModal
        open={signInOpen}
        next={signInNext}
        onClose={() => setSignInOpen(false)}
      />
    </>
  );
}

function MenuItem({
  to, children, onClick,
}: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to as any}
      onClick={onClick}
      className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-background dark:text-foreground/80"
    >{children}</Link>
  );
}
