"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onIdTokenChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

type AuthContext = {
  user: User | null;
  loading: boolean;
  logout: (expired?: boolean) => Promise<void>;
};

const Context = createContext<AuthContext | null>(null);

/** Firebase Auth owns the session and refresh tokens; no custom session cookies. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => onIdTokenChanged(auth, currentUser => {
    setUser(currentUser);
    setLoading(false);
  }, () => {
    setUser(null);
    setLoading(false);
  }), []);

  const logout = useCallback(async (expired = false) => {
    try { await signOut(auth); }
    finally { router.replace(expired ? "/signin?expired=1" : "/"); }
  }, [router]);

  const value = useMemo(() => ({ user, loading, logout }), [user, loading, logout]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthContext {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
