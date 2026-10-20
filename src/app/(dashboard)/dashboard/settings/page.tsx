"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import {
  Settings,
  ChevronRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  verifyBeforeUpdateEmail,
  updatePassword,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";

type MsgKind = "success" | "error" | "info";

const AVAILABLE_INTERESTS = [
  {
    id: "bitcoin",
    label: "Bitcoin",
  },
  {
    id: "ethereum",
    label: "Ethereum",
  },
  {
    id: "monero",
    label: "Monero",
  },
  {
    id: "gold",
    label: "Gold",
  },
  {
    id: "silver",
    label: "Silver",
  },
] as const;

export default function SettingsPage() {
  const { logout } = useAuth();

  const [user, setUser] = React.useState<User | null>(
    auth.currentUser
  );

  const [loading, setLoading] = React.useState(false);
  const [interestsLoading, setInterestsLoading] =
    React.useState(true);

  const [interests, setInterests] = React.useState<string[]>([]);
  const [editingInterests, setEditingInterests] =
    React.useState(false);
  const [interestDraft, setInterestDraft] = React.useState<
    string[]
  >([]);

  const [emailForm, setEmailForm] = React.useState({
    newEmail: auth.currentUser?.email || "",
    currentPassword: "",
  });

  const [pwdForm, setPwdForm] = React.useState({
    currentPassword: "",
    newPassword: "",
  });

  const [msg, setMsg] = React.useState<{
    kind: MsgKind;
    text: string;
  } | null>(null);

  // --------------------------------------------------
  // Firebase auth state
  // --------------------------------------------------

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (u?.email) {
        setEmailForm((f) => ({
          ...f,
          newEmail: u.email!,
        }));
      }
    });

    return unsub;
  }, []);

  // --------------------------------------------------
  // Messages
  // --------------------------------------------------

  function showMsg(kind: MsgKind, text: string) {
    setMsg({ kind, text });

    setTimeout(() => {
      setMsg(null);
    }, 5000);
  }

  // --------------------------------------------------
  // Provider
  // --------------------------------------------------

  function primaryProviderId(u: User | null) {
    return u?.providerData?.[0]?.providerId || null;
  }

  // --------------------------------------------------
  // Load user profile / interests
  // --------------------------------------------------

  React.useEffect(() => {
    async function loadUserProfile() {
      if (!auth.currentUser) {
        setInterestsLoading(false);
        return;
      }

      setInterestsLoading(true);

      try {
        const token = await auth.currentUser.getIdToken();

        const response = await fetch("/api/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load profile");
        }

        const data = await response.json();

        const loadedInterests = Array.isArray(data?.interests)
          ? data.interests.filter(
              (interest: unknown): interest is string =>
                typeof interest === "string" &&
                interest.trim().length > 0
            )
          : [];

        setInterests(loadedInterests);
      } catch (error) {
        console.warn(
          "Failed to load user profile:",
          error
        );

        setInterests([]);
      } finally {
        setInterestsLoading(false);
      }
    }

    void loadUserProfile();
  }, [user?.uid]);

  // --------------------------------------------------
  // Interest editor
  // --------------------------------------------------

  function startEditingInterests() {
    setInterestDraft([...interests]);
    setEditingInterests(true);
  }

  function cancelEditingInterests() {
    setInterestDraft([...interests]);
    setEditingInterests(false);
  }

  function toggleInterest(interest: string) {
    setInterestDraft((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }

      return [...current, interest];
    });
  }

  async function saveInterests() {
    if (!user) {
      showMsg("error", "You must be signed in.");
      return;
    }

    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error("Missing authentication token.");
      }

      const response = await fetch(
        "/api/user/interests",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            interests: interestDraft,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update interests."
        );
      }

      const savedInterests = Array.isArray(data?.interests)
        ? data.interests
        : [];

      setInterests(savedInterests);
      setInterestDraft(savedInterests);
      setEditingInterests(false);

      showMsg("success", "Interests updated.");
    } catch (error) {
      console.error("Failed to update interests:", error);

      showMsg(
        "error",
        error instanceof Error
          ? error.message
          : "Failed to update interests."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // Firebase errors
  // --------------------------------------------------

  function mapFirebaseError(err: unknown): string {
    const code =
      (err as any)?.code ||
      (err as any)?.message ||
      String(err);

    if (typeof code !== "string") {
      return "Something went wrong.";
    }

    if (code.includes("auth/requires-recent-login")) {
      return "Please reauthenticate and try again.";
    }

    if (
      code.includes("auth/invalid-credential") ||
      code.includes("auth/wrong-password")
    ) {
      return "Your current password is incorrect.";
    }

    if (
      code.includes("auth/email-already-in-use")
    ) {
      return "That email is already in use.";
    }

    if (code.includes("auth/invalid-email")) {
      return "Please enter a valid email address.";
    }

    if (code.includes("auth/weak-password")) {
      return "Password is too weak.";
    }

    if (
      code.includes("auth/popup-closed-by-user")
    ) {
      return "Sign-in popup was closed.";
    }

    return code.replace("Firebase:", "").trim();
  }

  // --------------------------------------------------
  // Mirror email
  // --------------------------------------------------

  async function mirrorEmail() {
    if (!auth.currentUser) return;

    try {
      const token =
        await auth.currentUser.getIdToken(true);

      await fetch("/api/crypto/settings", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.warn("Mirror email failed", e);
    }
  }

  React.useEffect(() => {
    if (user?.email) {
      void mirrorEmail();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // --------------------------------------------------
  // Update Email
  // --------------------------------------------------

  const handleUpdateEmail: React.FormEventHandler<
    HTMLFormElement
  > = async (e) => {
    e.preventDefault();

    if (!user) {
      return showMsg(
        "error",
        "You must be signed in."
      );
    }

    const nextEmail = emailForm.newEmail.trim();

    if (!nextEmail) {
      return showMsg(
        "error",
        "Email cannot be empty."
      );
    }

    setLoading(true);

    try {
      const providerId = primaryProviderId(user);

      if (providerId === "password") {
        if (!emailForm.currentPassword) {
          setLoading(false);

          return showMsg(
            "error",
            "Please enter your current password."
          );
        }

        const cred =
          EmailAuthProvider.credential(
            user.email || "",
            emailForm.currentPassword
          );

        await reauthenticateWithCredential(
          user,
          cred
        );
      } else {
        const provider =
          new GoogleAuthProvider();

        await reauthenticateWithPopup(
          user,
          provider
        );
      }

      await verifyBeforeUpdateEmail(
        user,
        nextEmail
      );

      showMsg(
        "success",
        "Verification email sent. Confirm the change from your inbox, then reopen this page."
      );

      await auth.currentUser?.reload();

      setUser(auth.currentUser || null);

      setEmailForm((f) => ({
        ...f,
        currentPassword: "",
      }));
    } catch (err) {
      showMsg(
        "error",
        mapFirebaseError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Update Password
  // --------------------------------------------------

  const handleUpdatePassword: React.FormEventHandler<
    HTMLFormElement
  > = async (e) => {
    e.preventDefault();

    if (!user) {
      return showMsg(
        "error",
        "You must be signed in."
      );
    }

    const {
      newPassword,
      currentPassword,
    } = pwdForm;

    if (
      !newPassword ||
      newPassword.length < 8
    ) {
      return showMsg(
        "error",
        "New password must be at least 8 characters."
      );
    }

    setLoading(true);

    try {
      const providerId =
        primaryProviderId(user);

      if (providerId === "password") {
        if (!currentPassword) {
          setLoading(false);

          return showMsg(
            "error",
            "Please enter your current password."
          );
        }

        const cred =
          EmailAuthProvider.credential(
            user.email || "",
            currentPassword
          );

        await reauthenticateWithCredential(
          user,
          cred
        );
      } else {
        const provider =
          new GoogleAuthProvider();

        await reauthenticateWithPopup(
          user,
          provider
        );
      }

      await updatePassword(
        user,
        newPassword
      );

      setPwdForm({
        currentPassword: "",
        newPassword: "",
      });

      /*
       * Password changes invalidate existing authentication credentials.
       * End the current application session immediately so the Firebase
       * client, Next.js session cookie, and backend auth state stay aligned.
       */
      await logout(false);
    } catch (err) {
      showMsg(
        "error",
        mapFirebaseError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />

          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Settings
            </h1>

            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your account and preferences.
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div
          className={[
            "mb-6 rounded-lg border px-3 py-2.5 text-sm",
            msg.kind === "success" &&
              "border-green-200 bg-green-50 text-green-800",
            msg.kind === "error" &&
              "border-red-200 bg-red-50 text-red-800",
            msg.kind === "info" &&
              "border-blue-200 bg-blue-50 text-blue-800",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
        >
          {msg.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {/* ----------------------------------------- */}
        {/* Preferences */}
        {/* ----------------------------------------- */}

        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold">
            Preferences
          </h2>
        </div>

        <div className="border-t">
          {/* Wallets */}
          <Link
            href="/dashboard/wallets"
            className="group flex min-h-[76px] items-center justify-between gap-6 px-5 py-4 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Wallets
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage your connected wallets.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-sm font-medium text-muted-foreground group-hover:text-foreground sm:block">
                Edit wallets
              </span>

              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <div className="border-t" />

          {/* Interests */}
          <div className="px-5 py-5">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Interests
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Used to personalize your experience.
                </p>
              </div>

              {!editingInterests && (
                <button
                  type="button"
                  onClick={
                    startEditingInterests
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>

            {/* Current interests */}
            {!editingInterests && (
              <div className="mt-3">
                {interestsLoading ? (
                  <span className="text-sm text-muted-foreground">
                    Loading…
                  </span>
                ) : interests.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {interests.map(
                      (interest) => (
                        <span
                          key={interest}
                          className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {interest.charAt(0).toUpperCase() +
                            interest.slice(1)}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No interests
                  </span>
                )}
              </div>
            )}

            {/* Interest editor */}
            {editingInterests && (
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {AVAILABLE_INTERESTS.map(
                    (interest) => {
                      const selected =
                        interestDraft.includes(
                          interest.id
                        );

                      return (
                        <button
                          key={interest.id}
                          type="button"
                          onClick={() =>
                            toggleInterest(
                              interest.id
                            )
                          }
                          className={[
                            "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              {interest.label}
                            </span>

                            {selected && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      saveInterests
                    }
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {loading
                      ? "Saving…"
                      : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      cancelEditingInterests
                    }
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>

                  {interestDraft.length === 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      No interests selected
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------- */}
        {/* Account */}
        {/* ----------------------------------------- */}

        <div className="border-t px-5 py-4">
          <h2 className="text-sm font-semibold">
            Account
          </h2>
        </div>

        <div className="border-t">
          {/* Email */}
          <div className="px-5 py-5">
            <div className="mb-4">
              <p className="text-sm font-medium">
                Email address
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Update the email associated with
                your account.
              </p>
            </div>

            <form
              onSubmit={
                handleUpdateEmail
              }
              className="max-w-xl space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="newEmail"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Email
                </label>

                <input
                  id="newEmail"
                  type="email"
                  value={
                    emailForm.newEmail
                  }
                  onChange={(e) =>
                    setEmailForm(
                      (f) => ({
                        ...f,
                        newEmail:
                          e.target
                            .value,
                      })
                    )
                  }
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>

              {primaryProviderId(
                user
              ) === "password" && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="emailCurrentPassword"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Current password
                  </label>

                  <input
                    id="emailCurrentPassword"
                    type="password"
                    value={
                      emailForm.currentPassword
                    }
                    onChange={(e) =>
                      setEmailForm(
                        (f) => ({
                          ...f,
                          currentPassword:
                            e.target
                              .value,
                        })
                      )
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                {loading
                  ? "Saving…"
                  : "Update email"}
              </button>

              <p className="text-xs text-muted-foreground">
                A verification link will be
                sent to your new email.
              </p>
            </form>
          </div>

          <div className="border-t" />

          {/* Password */}
          <div className="px-5 py-5">
            <div className="mb-4">
              <p className="text-sm font-medium">
                Password
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Change your password to keep
                your account secure.
              </p>
            </div>

            <form
              onSubmit={
                handleUpdatePassword
              }
              className="max-w-xl space-y-4"
            >
              {primaryProviderId(
                user
              ) === "password" && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="currentPassword"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Current password
                  </label>

                  <input
                    id="currentPassword"
                    type="password"
                    value={
                      pwdForm.currentPassword
                    }
                    onChange={(e) =>
                      setPwdForm(
                        (f) => ({
                          ...f,
                          currentPassword:
                            e.target
                              .value,
                        })
                      )
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="newPassword"
                  className="text-xs font-medium text-muted-foreground"
                >
                  New password
                </label>

                <input
                  id="newPassword"
                  type="password"
                  value={
                    pwdForm.newPassword
                  }
                  onChange={(e) =>
                    setPwdForm(
                      (f) => ({
                        ...f,
                        newPassword:
                          e.target.value,
                      })
                    )
                  }
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="At least 8 characters"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                {loading
                  ? "Saving…"
                  : "Update password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}