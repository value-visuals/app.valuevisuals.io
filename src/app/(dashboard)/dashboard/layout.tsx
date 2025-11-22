"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import Nav from "@/components/NavBar"; // ⬅️ use the new navbar

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobileOpen(false);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return (
    <RequireAuth>
      <div className="flex w-full min-h-dvh">

        <div className="flex-1 min-w-0 w-full">
          {/* Top Navbar */}
          <Nav />

          <main className="px-4 md:px-6 lg:pr-8 py-4 md:py-6">
            <div className="pt-px">{children}</div>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
