"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { Settings } from "lucide-react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  verifyBeforeUpdateEmail,
  updatePassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type MsgKind = "success" | "error" | "info";

export default function SettingsPage() {
  const [user, setUser] = React.useState<User | null>(auth.currentUser);
  const [loading, setLoading] = React.useState(false);

  // --- Email form state ---
  const [emailForm, setEmailForm] = React.useState({
    newEmail: auth.currentUser?.email || "",
    currentPassword: "", // only used for password-provider accounts
  });

  // --- Password form state (optional immediate change) ---
  const [pwdForm, setPwdForm] = React.useState({
    currentPassword: "",
    newPassword: "",
  });

  const [msg, setMsg] = React.useState<{ kind: MsgKind; text: string } | null>(null);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.email) {
        setEmailForm((f) => ({ ...f, newEmail: u.email! }));
      }
    });
    return unsub;
  }, []);

  function showMsg(kind: MsgKind, text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 5000);
  }

  function primaryProviderId(u: User | null) {
    return u?.providerData?.[0]?.providerId || null;
  }

  function mapFirebaseError(err: unknown): string {
    const code = (err as any)?.code || (err as any)?.message || String(err);
    if (typeof code !== "string") return "Something went wrong.";
    if (code.includes("auth/requires-recent-login")) return "Please reauthenticate and try again.";
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password"))
      return "Your current password is incorrect.";
    if (code.includes("auth/email-already-in-use")) return "That email is already in use.";
    if (code.includes("auth/invalid-email")) return "Please enter a valid email address.";
    if (code.includes("auth/weak-password")) return "Password is too weak.";
    if (code.includes("auth/popup-closed-by-user")) return "Sign-in popup was closed.";
    return code.replace("Firebase:", "").trim();
  }

  // -------------------------
  // Mirror authed email to backend/Firestore AFTER it actually changes
  // -------------------------
  async function mirrorEmail() {
    if (!auth.currentUser) return;
    try {
      // Force-refresh to get a token that reflects the current email/claims
      const token = await auth.currentUser.getIdToken(true);
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

  // When user's email actually changes (after verification), mirror it
  React.useEffect(() => {
    if (user?.email) {
      void mirrorEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // -------------------------
  // Update Email (provider-aware reauth + verification)
  // -------------------------
  const handleUpdateEmail: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!user) return showMsg("error", "You must be signed in.");
    const nextEmail = emailForm.newEmail.trim();
    if (!nextEmail) return showMsg("error", "Email cannot be empty.");

    setLoading(true);
    try {
      const providerId = primaryProviderId(user);

      // 1) Reauthenticate:
      if (providerId === "password") {
        if (!emailForm.currentPassword) {
          setLoading(false);
          return showMsg("error", "Please enter your current password.");
        }
        const cred = EmailAuthProvider.credential(user.email || "", emailForm.currentPassword);
        await reauthenticateWithCredential(user, cred);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      // 2) Safer: send verification to new email; Auth switches after confirmation
      await verifyBeforeUpdateEmail(user, nextEmail);
      showMsg(
        "success",
        "Verification email sent. After you confirm from your inbox, reopen this page; your email will sync automatically."
      );

      // 3) Refresh local state; do NOT mirror yet (email not changed until verification)
      await auth.currentUser?.reload();
      const fresh = auth.currentUser;
      setUser(fresh || null);
      setEmailForm((f) => ({ ...f, currentPassword: "" }));
    } catch (err) {
      showMsg("error", mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Password reset via email link
  // -------------------------
  const handlePasswordReset = async () => {
    if (!user?.email) return showMsg("error", "No email found on your account.");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      showMsg("success", `Password reset email sent to ${user.email}.`);
    } catch (err) {
      showMsg("error", mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Optional: immediate password update (reauth + updatePassword)
  // -------------------------
  const handleUpdatePassword: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!user) return showMsg("error", "You must be signed in.");
    const { newPassword, currentPassword } = pwdForm;
    if (!newPassword || newPassword.length < 8) {
      return showMsg("error", "New password must be at least 8 characters.");
    }
    setLoading(true);
    try {
      const providerId = primaryProviderId(user);
      if (providerId === "password") {
        if (!currentPassword) {
          setLoading(false);
          return showMsg("error", "Please enter your current password.");
        }
        const cred = EmailAuthProvider.credential(user.email || "", currentPassword);
        await reauthenticateWithCredential(user, cred);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      await updatePassword(user, newPassword);
      showMsg("success", "Password updated successfully.");
      setPwdForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      showMsg("error", mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    // At the very top-level wrapper of the page
    <div className="mx-auto max-w-7xl p-4 md:p-6 bg-background text-foreground">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Settings className="h-6 w-6 text-muted-foreground" />
        Settings
      </h1>

      {msg && (
        <div
          className={[
            "mb-4 rounded-lg border px-3 py-2 text-sm",
            msg.kind === "success" && "border-green-300 bg-green-50 text-green-800",
            msg.kind === "error" && "border-red-300 bg-red-50 text-red-800",
            msg.kind === "info" && "border-blue-300 bg-blue-50 text-blue-800",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
        >
          {msg.text}
        </div>
      )}

      {/* Email Card */}
      <div className="mb-6 rounded-2xl border bg-card text-card-foreground p-4">
        <h2 className="mb-1 text-lg font-medium">Email</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Update the email associated with your account. You may be asked to reauthenticate.
        </p>

        <form onSubmit={handleUpdateEmail} className="grid gap-4">
          <div className="grid gap-1">
            <label htmlFor="newEmail" className="text-sm font-medium">
              New Email
            </label>
            <input
              id="newEmail"
              type="email"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary transition-colors"
              placeholder="you@example.com"
            />
          </div>

          {/* Only show current password for password-based accounts */}
          {primaryProviderId(user) === "password" && (
            <div className="grid gap-1">
              <label htmlFor="emailCurrentPassword" className="text-sm font-medium">
                Current Password
              </label>
              <input
                id="emailCurrentPassword"
                type="password"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm((f) => ({ ...f, currentPassword: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border 
              bg-secondary text-secondary-foreground hover:bg-[var(--surface-dark)]
              dark:hover:bg-[#111]
              px-3 py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            {loading ? "Saving…" : "Update Email"}
          </button>
          <span className="text-xs text-muted-foreground max-w-[180px] sm:max-w-none leading-tight">
            We’ll email a verification link to confirm the change.
          </span>
        </div>
        </form>
      </div>

      {/* Password Card */}
      <div className="mb-6 rounded-2xl border bg-card text-card-foreground p-4">

        <h2 className="mb-1 text-lg font-medium">Password</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Change your password or send yourself a reset link.
        </p>

        {/* Optional: direct password change */}
        <form onSubmit={handleUpdatePassword} className="mb-4 grid gap-4">
          {primaryProviderId(user) === "password" && (
            <div className="grid gap-1">
              <label htmlFor="currentPassword" className="text-sm font-medium">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}
          <div className="grid gap-1">
            <label htmlFor="newPassword" className="text-sm font-medium">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary transition-colors"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border 
                bg-secondary text-secondary-foreground hover:bg-[var(--surface-dark)]
                dark:hover:bg-[#111]
                px-3 py-2 text-sm font-medium disabled:opacity-50 transition"
            >
              {loading ? "Saving…" : "Update Password"}
            </button>
          </div>
        </form>

        {/* Password reset link
        <button
          type="button"
          disabled={loading}
          onClick={handlePasswordReset}
              className="inline-flex items-center gap-2 rounded-xl border border-border 
                bg-secondary text-secondary-foreground hover:bg-[var(--surface-dark)]
                dark:hover:bg-[#111]
                px-3 py-2 text-sm font-medium disabled:opacity-50 transition"
        >
          Send password reset email
        </button> */}
      </div>
    </div>
  );
}
