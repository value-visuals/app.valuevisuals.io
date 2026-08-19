// src/components/auth/AuthProvider.tsx

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  onAuthStateChanged,
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

/*
 * ============================================================
 * PRODUCTION SESSION SETTINGS
 * ============================================================
 *
 * Assumes a Firebase ID-token/session lifetime of approximately
 * 60 minutes.
 *
 * Warning:
 *   5 minutes before expiration
 *
 * Automatic logout:
 *   At the expiration boundary
 */
const SESSION_WARNING_MS = 55 * 60 * 1000;
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "";

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [sessionWarning, setSessionWarning] =
    useState(false);

  const warningTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const logoutTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const sessionCycleRef = useRef(0);

  /*
   * Prevent multiple simultaneous logout operations.
   */
  const logoutInProgressRef =
    useRef(false);


  // ==========================================================
  // CLEAR SESSION TIMERS
  // ==========================================================

  const clearSessionTimers =
    useCallback(() => {
      if (
        warningTimerRef.current !== null
      ) {
        clearTimeout(
          warningTimerRef.current
        );

        warningTimerRef.current = null;
      }

      if (
        logoutTimerRef.current !== null
      ) {
        clearTimeout(
          logoutTimerRef.current
        );

        logoutTimerRef.current = null;
      }
    }, []);


  // ==========================================================
  // START SESSION TIMER
  // ==========================================================

  const startSessionTimer =
    useCallback(() => {
      clearSessionTimers();

      const cycle =
        ++sessionCycleRef.current;

      setSessionWarning(false);

      warningTimerRef.current =
        setTimeout(() => {
          if (
            cycle !==
            sessionCycleRef.current
          ) {
            return;
          }

          if (!auth.currentUser) {
            return;
          }

          setSessionWarning(true);
        }, SESSION_WARNING_MS);

      logoutTimerRef.current =
        setTimeout(() => {
          if (
            cycle !==
            sessionCycleRef.current
          ) {
            return;
          }

          if (!auth.currentUser) {
            return;
          }

          void logout(true);
        }, SESSION_TIMEOUT_MS);
    }, [
      clearSessionTimers,
    ]);


  // ==========================================================
  // SYNCHRONIZE NEXT.JS SESSION
  // ==========================================================

  const syncNextSession =
    useCallback(
      async (
        currentUser: User,
        forceRefresh = false
      ) => {

        const idToken =
          await currentUser.getIdToken(
            forceRefresh
          );

        const response =
          await fetch(
            "/api/auth/session",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials: "include",

              cache: "no-store",

              body: JSON.stringify({
                idToken,
              }),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          const error =
            new Error(
              data?.error ||
                "Unable to establish frontend session"
            );

          (
            error as any
          ).status = response.status;

          (
            error as any
          ).code = data?.code;

          throw error;
        }

        return idToken;
      },
      []
    );


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout =
    useCallback(
      async (expired = false) => {
        /*
         * Prevent duplicate logout operations.
         */
        if (
          logoutInProgressRef.current
        ) {
          return;
        }

        logoutInProgressRef.current =
          true;

        /*
         * Stop all client-side timers immediately.
         */
        clearSessionTimers();

        /*
         * Invalidate all previously scheduled timer callbacks.
         */
        sessionCycleRef.current++;

        setSessionWarning(false);

        const currentUser =
          auth.currentUser;

        try {
          // ====================================================
          // STEP 1
          // REVOKE FIREBASE REFRESH TOKENS
          // ====================================================

          if (currentUser) {
            try {
              const idToken =
                await currentUser.getIdToken();

              const signoutUrl =
                `${API_BASE_URL}/auth/signout`;

              const response =
                await fetch(
                  signoutUrl,
                  {
                    method: "POST",

                    headers: {
                      Authorization:
                        `Bearer ${idToken}`,

                      "Content-Type":
                        "application/json",
                    },

                    credentials:
                      "include",

                    cache: "no-store",
                  }
                );

              /*
               * A token that is already expired/revoked should
               * not prevent local logout from completing.
               */
              if (!response.ok) {
                console.warn(
                  "[AUTH] Backend signout returned:",
                  response.status
                );
              }
            } catch (error) {
              /*
               * Local logout must still happen if the backend
               * is unavailable.
               */
              console.error(
                "[AUTH] Backend signout failed:",
                error
              );
            }
          }


          // ====================================================
          // STEP 2
          // DELETE NEXT.JS SESSION COOKIE
          // ====================================================

          try {
            const response =
              await fetch(
                "/api/auth/signout",
                {
                  method: "POST",

                  credentials:
                    "include",

                  cache: "no-store",
                }
              );

            if (!response.ok) {
              console.warn(
                "[AUTH] Next.js signout returned:",
                response.status
              );
            }
          } catch (error) {
            console.error(
              "[AUTH] Next.js session cleanup failed:",
              error
            );
          }


          // ====================================================
          // STEP 3
          // SIGN OUT FIREBASE CLIENT
          // ====================================================

          try {
            await firebaseSignOut(
              auth
            );
          } catch (error) {
            console.error(
              "[AUTH] Firebase client signout failed:",
              error
            );
          }
        } finally {
          /*
           * Always leave the protected application.
           */
          window.location.href =
            expired
              ? "/signin?expired=1"
              : "/signin";
        }
      },
      [
        clearSessionTimers,
      ]
    );


  // ==========================================================
  // CONTINUE SESSION
  // ==========================================================

  const continueSession =
    useCallback(
      async () => {
        const currentUser =
          auth.currentUser;

        if (!currentUser) {
          await logout(true);
          return;
        }

        try {
          /*
           * Force Firebase to obtain a fresh ID token.
           */
          await syncNextSession(
            currentUser,
            true
          );

          /*
           * Hide the warning.
           */
          setSessionWarning(false);

          /*
           * Start a completely new 60-minute session cycle.
           */
          startSessionTimer();
        } catch (error) {
          console.error(
            "[AUTH] Continue session failed:",
            error
          );

          /*
           * If the token cannot be refreshed or the frontend
           * session cannot be synchronized, terminate the
           * session.
           */
          await logout(true);
        }
      },
      [
        logout,
        startSessionTimer,
        syncNextSession,
      ]
    );


  // ==========================================================
  // FIREBASE AUTH STATE
  // ==========================================================

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          setUser(
            currentUser
          );

          setLoading(false);

          /*
           * USER SIGNED OUT
           */
          if (!currentUser) {
            clearSessionTimers();

            sessionCycleRef.current++;

            setSessionWarning(
              false
            );

            return;
          }

          /*
           * USER SIGNED IN
           *
           * Synchronize the frontend session cookie and then
           * begin the application session timer.
           */
          try {
            await syncNextSession(
              currentUser,
              false
            );

            startSessionTimer();
          } catch (error) {
            console.error(
              "[AUTH] Initial session synchronization failed:",
              error
            );

            await logout(true);
          }
        }
      );

    return () => {
      unsubscribe();

      clearSessionTimers();
    };
  }, [
    clearSessionTimers,
    logout,
    startSessionTimer,
    syncNextSession,
  ]);


  // ==========================================================
  // PROVIDER
  // ==========================================================

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

      {sessionWarning &&
        user && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-warning-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-2xl">
              <h2
                id="session-warning-title"
                className="text-xl font-semibold text-[var(--foreground)]"
              >
                Are you still there?
              </h2>

              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Your session will expire in
                approximately 5 minutes.
                Would you like to continue?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void logout(false)
                  }
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                >
                  Sign out
                </button>

                <button
                  type="button"
                  autoFocus
                  onClick={() =>
                    void continueSession()
                  }
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


// ============================================================
// useAuth
// ============================================================

export function useAuth() {
  return useContext(Ctx);
}