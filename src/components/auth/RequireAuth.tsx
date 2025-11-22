// ── src/components/auth/RequireAuth.tsx ──────────────────────
"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";


export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (!loading && !user) router.replace("/signin");
    }, [loading, user, router]);
    if (loading) return <div className="p-6">Loading…</div>;
    if (!user) return null; // redirected
    return <>{children}</>;
}