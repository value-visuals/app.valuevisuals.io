"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ChartCandlestick,
  ChartNoAxesCombined,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModal";
import { CurrencyToggle } from "@/components/Currency";
import ThemeToggle from "@/components/theme/ThemeToggle";

const assetLinks = [
  { id: "bitcoin", label: "Bitcoin", ticker: "BTC" },
  { id: "ethereum", label: "Ethereum", ticker: "ETH" },
  { id: "monero", label: "Monero", ticker: "XMR" },
  { id: "gold", label: "Gold", ticker: "XAU" },
  { id: "silver", label: "Silver", ticker: "XAG" },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { openAuth } = useAuthModal();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);
  const isMarkets = pathname === "/";
  const isAnalysis = pathname === "/dashboard" || assetLinks.some(asset => pathname === `/dashboard/${asset.id}`);
  const avatar = (user?.displayName || user?.email || "V").slice(0, 1).toUpperCase();

  return <>
    <header className="enterprise-header" ref={headerRef}>
      <div className="enterprise-header-inner">
        <Link href="/" className="enterprise-brand" aria-label="Value Visuals home" onClick={closeMenu}>
          <span className="enterprise-brandmark"><span className="brandmark-bars"><i/><i/><i/><i/></span></span>
          <span className="enterprise-wordmark">value<span>visuals</span><b>.</b></span>
        </Link>

        <div className="enterprise-header-right">
          <ThemeToggle className="enterprise-theme-control" />
          <button
            className="enterprise-menu-toggle"
            type="button"
            aria-label={open ? "Close menu" : user ? "Open profile and navigation menu" : "Open navigation menu"}
            aria-controls="enterprise-nav-menu"
            aria-expanded={open}
            onClick={() => setOpen(value => !value)}
          >
            {user ? <span className="enterprise-avatar">{avatar}</span> : open ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>

      {open && <div id="enterprise-nav-menu" className="enterprise-account-menu" role="region" aria-label="Navigation and preferences">
        {user && <div className="enterprise-account-heading">
          <span className="enterprise-avatar">{avatar}</span>
          <div><strong>{user.displayName || "My account"}</strong><span>{user.email}</span></div>
        </div>}

        <nav aria-label="Site pages">
          <span className="enterprise-menu-label">Explore</span>
          <Link href="/" className="enterprise-menu-link" aria-current={isMarkets ? "page" : undefined} onClick={closeMenu}><Compass size={17}/> Markets</Link>
          {user ? <>
            <Link href="/dashboard" className="enterprise-menu-link" aria-current={isAnalysis ? "page" : undefined} onClick={closeMenu}><LayoutDashboard size={17}/> My analysis</Link>
            <Link href="/dashboard/portfolio" className="enterprise-menu-link" aria-current={pathname.startsWith("/dashboard/portfolio") ? "page" : undefined} onClick={closeMenu}><ChartCandlestick size={17}/> Portfolio</Link>
            <Link href="/dashboard/wallets" className="enterprise-menu-link" aria-current={pathname.startsWith("/dashboard/wallets") ? "page" : undefined} onClick={closeMenu}><Wallet size={17}/> Wallets</Link>
          </> : !loading ? <>
            <button type="button" className="enterprise-menu-link" onClick={() => { closeMenu(); openAuth("signin", { next: "/dashboard" }); }}><LayoutDashboard size={17}/> My analysis</button>
            <button type="button" className="enterprise-menu-link" onClick={() => { closeMenu(); openAuth("signin", { next: "/dashboard/portfolio" }); }}><ChartCandlestick size={17}/> Portfolio</button>
            <button type="button" className="enterprise-menu-link" onClick={() => { closeMenu(); openAuth("signin", { next: "/dashboard/wallets" }); }}><Wallet size={17}/> Wallets</button>
          </> : null}
          <span className="enterprise-menu-label enterprise-menu-divider">Tracked assets</span>
          <div className="enterprise-menu-assets">
            {assetLinks.map(asset => <Link
              key={asset.id}
              href={user ? `/dashboard/${asset.id}` : `/#${asset.id}`}
              className="enterprise-menu-asset"
              onClick={closeMenu}
            ><span>{asset.label}</span><small>{asset.ticker}</small></Link>)}
          </div>
        </nav>

        <div className="enterprise-menu-preferences">
          <span className="enterprise-menu-label" id="nav-display-currency">Display currency</span>
          <CurrencyToggle className="enterprise-menu-currency" />
        </div>

        <div className="enterprise-menu-account">
          {user ? <>
            <Link href="/dashboard/settings" className="enterprise-menu-link" onClick={closeMenu}><Settings2 size={17}/> Settings</Link>
            <button type="button" className="enterprise-menu-link enterprise-logout" onClick={() => { closeMenu(); void logout(false); }}><LogOut size={17}/> Sign out</button>
          </> : !loading ? <>
            <button type="button" className="enterprise-menu-link" onClick={() => { closeMenu(); openAuth("signin"); }}>Sign in</button>
            <button type="button" className="enterprise-menu-link enterprise-menu-signup" onClick={() => { closeMenu(); openAuth("signup"); }}>Create account <ArrowRight size={15}/></button>
          </> : null}
        </div>
      </div>}
    </header>

    {/* Keep the existing mobile bottom navigation. The dropdown supplements it. */}
    <nav className="enterprise-mobile-bottom" aria-label="Mobile navigation">
      {user ? <>
        <Link href="/" className={isMarkets ? "active" : ""}><Compass size={21}/><span>Markets</span></Link>
        <Link href="/dashboard" className={isAnalysis ? "active" : ""}><Activity size={21}/><span>Analysis</span></Link>
        <Link href="/dashboard/portfolio" className={pathname.startsWith("/dashboard/portfolio") ? "active" : ""}><ChartNoAxesCombined size={21}/><span>Portfolio</span></Link>
        <Link href="/dashboard/wallets" className={pathname.startsWith("/dashboard/wallets") ? "active" : ""}><Wallet size={21}/><span>Wallets</span></Link>
      </> : <>
        <Link href="/" className={isMarkets ? "active" : ""}><Compass size={21}/><span>Markets</span></Link>
        <Link href="/#crypto"><Activity size={21}/><span>Crypto</span></Link>
        <Link href="/#metals"><ChartNoAxesCombined size={21}/><span>Metals</span></Link>
      </>}
    </nav>
  </>;
}
