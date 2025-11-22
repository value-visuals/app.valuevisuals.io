"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Menu,
  Bitcoin,
  ChartNoAxesCombined,
  Coins,
  Wallet,
  Medal,
  BarChart2,
  Gem
} from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SettingsButton from "@/components/SettingsButton";

const routes = [
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: BarChart2 },
  { href: "/dashboard/bitcoin", label: "Bitcoin", icon: Bitcoin },
  { href: "/dashboard/ethereum", label: "Ethereum", icon: Gem },
  { href: "/dashboard/gold", label: "Gold", icon: Medal },
  { href: "/dashboard/silver", label: "Silver", icon: Coins },
  { href: "/dashboard/wallets", label: "Wallets", icon: Wallet },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close with ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/80 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between">
          {/* Left: Logo */}
          <Link
            href="/dashboard"
            className="font-semibold tracking-tight text-xl select-none"
          >
            Value <span className="text-neutral-500 dark:text-neutral-400">Visuals</span>
          </Link>

          {/* Right: Hamburger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Open menu"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="
                inline-flex items-center justify-center rounded-xl p-2
                border border-border dark:border-neutral-600
                bg-transparent
                outline-none ring-0 transition
                focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600
              "
            >
              <Menu className="h-6 w-6 text-black dark:text-foreground" />
            </button>

            {/* Dropdown */}
            {open && (
              <div
                role="menu"
                aria-label="Main navigation"
                className="
                    fixed inset-x-0 top-14 w-screen z-50
                    sm:absolute sm:inset-auto sm:right-2 sm:top-full sm:mt-2 sm:w-[330px]
                    max-w-full sm:max-w-[330px]
                    rounded-none sm:rounded-2xl border border-border bg-background text-foreground shadow-xl overflow-hidden
                "
              >
                <div className="py-2">
                  {routes.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{label}</span>
                    </Link>
                  ))}

                  <div className="my-2 h-px bg-border" />

                  {/* Theme toggle + Settings + Logout */}
                  <div className="px-3 pb-3 pt-1 flex items-center gap-1">
                    <ThemeToggle />
                    <SettingsButton />
                    <LogoutButton />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
