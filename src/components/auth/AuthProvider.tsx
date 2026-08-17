"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  sessionWarning: boolean;
  continueSession: () => Promise<void>;
  logout: (expired?: boolean) => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  sessionWarning: false,
  continueSession: async () => {},
  logout: async () => {},
});

const SESSION_WARNING_MS = 50 * 60 * 1000;
const SESSION_GRACE_MS = 5 * 60 * 1000;

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);

  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
      warningTimer.current = null;
    }

    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
  }

  function startSessionTimer() {
    clearTimers();

    warningTimer.current = setTimeout(() => {
      setSessionWarning(true);

      logoutTimer.current = setTimeout(() => {
        logout(true);
      }, SESSION_GRACE_MS);
    }, SESSION_WARNING_MS);
  }

  async function syncServerSession(currentUser: User) {
    const idToken = await currentUser.getIdToken();

    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to synchronize authentication session");
    }
  }

  async function continueSession() {
    if (!auth.currentUser) {
        console.log("[AUTH] No current Firebase user");
        return;
    }

    try {
        console.log("[AUTH] User clicked 'Yes, continue'");

        const oldToken = await auth.currentUser.getIdToken();

        console.log(
        "[AUTH] Current token before forced refresh:",
        oldToken.substring(0, 20) + "..."
        );

        const newToken = await auth.currentUser.getIdToken(true);

        console.log(
        "[AUTH] Token after forced refresh:",
        newToken.substring(0, 20) + "..."
        );

        console.log(
        "[AUTH] Token changed:",
        oldToken !== newToken
        );

        const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            idToken: newToken,
        }),
        });

        console.log(
        "[AUTH] /api/auth/session response:",
        response.status
        );

        if (!response.ok) {
        throw new Error("Unable to refresh session");
        }

        console.log("[AUTH] Server session successfully refreshed");

        setSessionWarning(false);
        startSessionTimer();

    } catch (err) {
        console.error("[AUTH] Session refresh failed:", err);
        await logout();
    }
    }

  async function logout(expired = false) {
    clearTimers();
    setSessionWarning(false);

    try {
      await fetch("/api/auth/signout", {
        method: "POST",
      });
    } catch (err) {
      console.error("Server signout failed:", err);
    } finally {
        await firebaseSignOut(auth);

        if (expired) {
        window.location.href = "/signin?expired=1";
        } else {
        window.location.href = "/signin";
        }
    }
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) {
        clearTimers();
        setSessionWarning(false);
      }
    });

    /*
     * Firebase fires this whenever the ID token changes,
     * including automatic token refreshes.
     */
    const unsubToken = onIdTokenChanged(auth, async (currentUser) => {
      if (!currentUser) {
        clearTimers();
        return;
      }

      try {
        await syncServerSession(currentUser);
        startSessionTimer();
      } catch (err) {
        console.error("Unable to sync Firebase token:", err);
      }
    });

    return () => {
      unsubAuth();
      unsubToken();
      clearTimers();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        sessionWarning,
        continueSession,
        logout,
      }}
    >
      {children}

      {sessionWarning && user && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Are you still there?
            </h2>

            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Your session is about to expire. Would you like to continue?
            </p>

            <div className="mt-6 flex justify-end gap-3">
            <button
                type="button"
                onClick={() => logout()}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                >
                Sign out
            </button>

              <button
                type="button"
                onClick={continueSession}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white"
              >
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}