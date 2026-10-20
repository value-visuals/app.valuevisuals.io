"use client";
import RequireAuth from "@/components/auth/RequireAuth";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth><div className="vv-legacy-container"><main className="vv-main py-3 sm:py-4" role="main">{children}</main></div></RequireAuth>;
}
