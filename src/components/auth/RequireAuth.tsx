"use client";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModal";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { openAuth } = useAuthModal();

  useEffect(() => {
    if (!loading && !user) openAuth("signin");
  }, [loading, user, openAuth]);

  if (loading) return <div className="enterprise-auth-loading" role="status">Loading your workspace…</div>;
  if (!user) return <div className="enterprise-auth-loading" role="status">Sign in to access your private workspace.</div>;
  return <>{children}</>;
}
