"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  Pencil,
  Save,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  type User,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { useAuth } from "@/components/auth/AuthProvider";

type Message = { kind: "success" | "error" | "info"; text: string };
const INTERESTS = [
  { id: "bitcoin", label: "Bitcoin" },
  { id: "ethereum", label: "Ethereum" },
  { id: "monero", label: "Monero" },
  { id: "gold", label: "Gold" },
  { id: "silver", label: "Silver" },
] as const;

const fieldClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-foreground/50 focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:opacity-60";
const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50";
const solidButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-semibold text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_1px_3px_rgba(12,20,32,0.03)] ${className}`}>{children}</section>;
}

function CardHeading({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">{icon}</span>
      <div><h2 className="text-sm font-semibold sm:text-base">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
    </div>
    {action}
  </div>;
}

function describeDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function authError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/requires-recent-login": return "Please sign in again, then retry this change.";
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Your current password is incorrect.";
    case "auth/email-already-in-use": return "That email address is already in use.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/weak-password": return "Choose a stronger password.";
    case "auth/popup-closed-by-user": return "The sign-in popup was closed.";
    case "auth/network-request-failed": return "Network unavailable. Try again when your connection returns.";
    default: return error instanceof Error ? error.message.replace(/^Firebase:\s*/, "") : "Something went wrong. Please retry.";
  }
}

function signInMethods(user: User | null): string[] {
  if (!user) return [];
  const ids = [...new Set(user.providerData.map(provider => provider.providerId))];
  return ids.map(id => id === "password" ? "Email & password" : id === "google.com" ? "Google" : id === "github.com" ? "GitHub" : id === "apple.com" ? "Apple" : id);
}

export default function SettingsPage() {
  const { logout } = useAuth();
  const [user, setUser] = React.useState<User | null>(auth.currentUser);
  const [name, setName] = React.useState(auth.currentUser?.displayName ?? "");
  const [savedName, setSavedName] = React.useState(auth.currentUser?.displayName ?? "");
  const [email, setEmail] = React.useState(auth.currentUser?.email ?? "");
  const [emailPassword, setEmailPassword] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [busy, setBusy] = React.useState<"profile" | "email" | "password" | "interests" | null>(null);
  const [message, setMessage] = React.useState<Message | null>(null);
  const [interestsLoading, setInterestsLoading] = React.useState(true);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [editingInterests, setEditingInterests] = React.useState(false);
  const [interestDraft, setInterestDraft] = React.useState<string[]>([]);
  const messageTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, current => {
      setUser(current);
      setName(current?.displayName ?? "");
      setSavedName(current?.displayName ?? "");
      setEmail(current?.email ?? "");
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  function showMessage(kind: Message["kind"], text: string) {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage({ kind, text });
    messageTimer.current = setTimeout(() => setMessage(null), 7000);
  }

  React.useEffect(() => {
    let canceled = false;
    async function loadInterests() {
      if (!user) { setInterestsLoading(false); return; }
      setInterestsLoading(true);
      try {
        const response = await authenticatedFetch("/api/me");
        if (!response.ok) throw new Error("Could not load your interests.");
        const data: { interests?: unknown } = await response.json();
        const values = Array.isArray(data.interests)
          ? data.interests.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : [];
        if (!canceled) setInterests(values);
      } catch (error) {
        console.warn("Settings: profile load failed", error);
        if (!canceled) showMessage("error", "Could not load saved interests. Try again later.");
      } finally {
        if (!canceled) setInterestsLoading(false);
      }
    }
    void loadInterests();
    return () => { canceled = true; };
  }, [user?.uid]);

  // Preserve the existing backend email mirror after a verified email change.
  React.useEffect(() => {
    if (!user?.email) return;
    void authenticatedFetch("/api/crypto/settings", { method: "PUT" }).catch(error => {
      console.warn("Settings: email mirror failed", error);
    });
  }, [user?.email]);

  const providerIds = user?.providerData.map(provider => provider.providerId) ?? [];
  const passwordAccount = providerIds.includes("password");
  const googleAccount = providerIds.includes("google.com");
  const otherAccount = !passwordAccount && !googleAccount;
  const canChangePassword = passwordAccount || googleAccount;

  async function reauthenticate(current: User, password: string) {
    if (passwordAccount) {
      if (!password) throw new Error("Enter your current password to continue.");
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email ?? "", password));
    } else if (googleAccount) {
      await reauthenticateWithPopup(current, new GoogleAuthProvider());
    } else {
      throw new Error("This sign-in provider cannot be reauthenticated here yet.");
    }
  }

  const saveName: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    if (!user || busy) return;
    const value = name.trim();
    if (!value || value.length > 80) { showMessage("error", "Enter a name between 1 and 80 characters."); return; }
    setBusy("profile");
    try {
      await updateProfile(user, { displayName: value });
      setName(value);
      setSavedName(value);
      showMessage("success", "Profile name updated.");
    } catch (error) { showMessage("error", authError(error)); }
    finally { setBusy(null); }
  };

  const saveEmail: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    if (!user || busy) return;
    const next = email.trim();
    if (!next || !next.includes("@")) { showMessage("error", "Enter a valid email address."); return; }
    if (next.toLowerCase() === (user.email ?? "").toLowerCase()) {
      showMessage("info", "This is already your account email.");
      return;
    }
    setBusy("email");
    try {
      await reauthenticate(user, emailPassword);
      await verifyBeforeUpdateEmail(user, next);
      setEmailPassword("");
      showMessage("success", "Verification sent to your new address. Follow the link to finish updating your email.");
    } catch (error) { showMessage("error", authError(error)); }
    finally { setBusy(null); }
  };

  const savePassword: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    if (!user || busy || !canChangePassword) return;
    if (newPassword.length < 8) { showMessage("error", "New password must be at least 8 characters."); return; }
    setBusy("password");
    try {
      await reauthenticate(user, currentPassword);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      // Preserve the existing secure logout behavior after password changes.
      await logout(false);
    } catch (error) { showMessage("error", authError(error)); }
    finally { setBusy(null); }
  };

  function startInterests() { setInterestDraft([...interests]); setEditingInterests(true); }
  function cancelInterests() { setInterestDraft([...interests]); setEditingInterests(false); }
  function toggleInterest(id: string) {
    setInterestDraft(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  }
  async function saveInterests() {
    if (!user || busy) return;
    setBusy("interests");
    try {
      const response = await authenticatedFetch("/api/user/interests", {
        method: "PUT",
        body: JSON.stringify({ interests: interestDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save your interests.");
      const saved = Array.isArray(data?.interests) ? data.interests.filter((value: unknown): value is string => typeof value === "string") : [...interestDraft];
      setInterests(saved);
      setInterestDraft(saved);
      setEditingInterests(false);
      showMessage("success", "Interests updated.");
    } catch (error) { showMessage("error", authError(error)); }
    finally { setBusy(null); }
  }

  const initials = (savedName || user?.email || "VV").trim().slice(0, 2).toUpperCase();
  const joined = describeDate(user?.metadata.creationTime);
  const lastLogin = describeDate(user?.metadata.lastSignInTime);

  return <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 pb-12 pt-5 sm:px-6 sm:pt-8 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3 pb-1">
      <div><p className="text-[10px] font-semibold tracking-[0.13em] text-muted-foreground">YOUR WORKSPACE / ACCOUNT</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Settings<span className="text-muted-foreground">.</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Your profile, sign-in security and preferences in one place.</p></div>
      <Link href="/dashboard/portfolio" className={secondaryButton}>Your portfolio <ArrowRight size={15}/></Link>
    </header>

    {message && <div role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${message.kind === "error" ? "border-red-300/60 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-card text-foreground"}`}>{message.text}</div>}

    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-lg font-semibold tracking-tight">{initials}</div>
          <div className="min-w-0"><p className="truncate text-lg font-semibold">{savedName || "Your Value Visuals account"}</p><p className="mt-0.5 break-all text-sm text-muted-foreground">{user?.email || "No email associated"}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-md bg-muted px-2 py-1">{signInMethods(user).join(" + ") || "Account"}</span><span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">{user?.emailVerified ? <CheckCircle2 size={12}/> : <CircleHelp size={12}/>} {user?.emailVerified ? "Email verified" : "Email not verified"}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={16}/><span>Managed with Firebase Authentication</span></div>
      </div>
    </Card>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeading title="Personal profile" description="Update the name displayed on your account." icon={<UserRound size={17}/>}/>
          <form onSubmit={saveName} className="space-y-4 p-5 sm:p-6">
            <div><label htmlFor="profile-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">Display name</label>
              <input id="profile-name" className={fieldClass} maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" disabled={Boolean(busy)}/></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Stored in your Firebase profile.</p><button type="submit" className={solidButton} disabled={Boolean(busy) || name.trim() === savedName || !name.trim()}><Save size={15}/>{busy === "profile" ? "Saving…" : "Save profile"}</button></div>
          </form>
        </Card>

        <Card>
          <CardHeading title="Email address" description="A verification link is required before changing your account email." icon={<Mail size={17}/>}/>
          <form onSubmit={saveEmail} className="space-y-4 p-5 sm:p-6">
            <div><label htmlFor="account-email" className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label><input id="account-email" type="email" autoComplete="email" className={fieldClass} value={email} onChange={event => setEmail(event.target.value)} disabled={Boolean(busy) || otherAccount}/></div>
            {passwordAccount && <div><label htmlFor="email-verify-password" className="mb-1.5 block text-xs font-medium text-muted-foreground">Current password</label><input id="email-verify-password" type="password" autoComplete="current-password" className={fieldClass} value={emailPassword} onChange={event => setEmailPassword(event.target.value)} disabled={Boolean(busy)} placeholder="Confirm your identity"/></div>}
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{otherAccount ? "Email changes for this sign-in provider are not supported here yet." : googleAccount && !passwordAccount ? "You'll confirm your Google account before the verification email is sent." : "Your current password is used only for reauthentication."}</p><button type="submit" className={secondaryButton} disabled={Boolean(busy) || otherAccount || email.trim().toLowerCase() === (user?.email ?? "").toLowerCase()}>{busy === "email" ? "Sending…" : "Verify new email"} <ArrowRight size={14}/></button></div>
          </form>
        </Card>

        <Card>
          <CardHeading title="Password & sign-in" description="Keep your account protected with a secure sign-in method." icon={<LockKeyhole size={17}/>}/>
          {canChangePassword ? <form onSubmit={savePassword} className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">{passwordAccount && <div><label htmlFor="password-current" className="mb-1.5 block text-xs font-medium text-muted-foreground">Current password</label><input id="password-current" className={fieldClass} type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={Boolean(busy)}/></div>}
              <div><label htmlFor="password-next" className="mb-1.5 block text-xs font-medium text-muted-foreground">{passwordAccount ? "New password" : "Set a password"}</label><input id="password-next" className={fieldClass} type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="At least 8 characters" disabled={Boolean(busy)}/></div></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{passwordAccount ? "You’ll be signed out after updating your password." : "Confirm your Google account to set a password. You’ll then be signed out."}</p><button type="submit" className={secondaryButton} disabled={Boolean(busy) || (passwordAccount && !currentPassword) || newPassword.length < 8}><KeyRound size={15}/>{busy === "password" ? "Updating…" : passwordAccount ? "Change password" : "Set password"}</button></div>
          </form> : <div className="flex items-start gap-3 p-5 text-sm text-muted-foreground sm:p-6"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/><p>Your account uses {signInMethods(user).join(" and ") || "a connected provider"} sign-in. Manage that provider's password in its own account settings.</p></div>}
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeading title="Your interests" description="Choose the assets that matter most to you." icon={<Pencil size={17}/>} action={!editingInterests && <button type="button" onClick={startInterests} disabled={interestsLoading || Boolean(busy)} className={secondaryButton}>Edit <Pencil size={13}/></button>}/>
          <div className="p-5 sm:p-6">
            {interestsLoading ? <p className="text-sm text-muted-foreground">Loading your interests…</p> : editingInterests ? <>
              <div className="grid grid-cols-2 gap-2">{INTERESTS.map(interest => <button key={interest.id} type="button" aria-pressed={interestDraft.includes(interest.id)} onClick={() => toggleInterest(interest.id)} disabled={Boolean(busy)} className={`flex min-h-10 items-center justify-between rounded-lg border px-3 text-left text-sm font-medium transition ${interestDraft.includes(interest.id) ? "border-foreground/45 bg-muted text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>{interest.label}{interestDraft.includes(interest.id) && <Check size={15}/>}</button>)}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" className={solidButton} onClick={() => void saveInterests()} disabled={Boolean(busy)}><Check size={15}/>{busy === "interests" ? "Saving…" : "Save interests"}</button><button type="button" className={secondaryButton} onClick={cancelInterests} disabled={Boolean(busy)}><X size={14}/> Cancel</button></div>
            </> : interests.length ? <div className="flex flex-wrap gap-2">{interests.map(interest => <span key={interest} className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium">{interest.charAt(0).toUpperCase() + interest.slice(1)}</span>)}</div> : <p className="text-sm text-muted-foreground">No interests selected yet.</p>}
          </div>
        </Card>

        <Card>
          <CardHeading title="Connected holdings" description="Manage the wallets used by your portfolio." icon={<Wallet size={17}/>}/>
          <Link href="/dashboard/wallets" className="group flex items-center justify-between gap-4 p-5 transition hover:bg-muted/35 sm:p-6"><div><p className="text-sm font-semibold">Bitcoin, gold & silver</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add, edit or review your existing wallets and metal holdings.</p></div><ChevronRight size={18} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"/></Link>
        </Card>

        <Card>
          <CardHeading title="Account details" description="Information associated with your authenticated profile." icon={<Fingerprint size={17}/>}/>
          <dl className="divide-y divide-border px-5 sm:px-6"><div className="flex items-center justify-between gap-3 py-3.5"><dt className="inline-flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays size={14}/> Member since</dt><dd className="text-right text-sm font-medium">{joined}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3.5"><dt className="text-xs text-muted-foreground">Last sign-in</dt><dd className="text-right text-sm font-medium">{lastLogin}</dd></div>
            <div className="flex items-start justify-between gap-3 py-3.5"><dt className="shrink-0 text-xs text-muted-foreground">User ID</dt><dd className="max-w-[66%] break-all text-right font-mono text-[11px] text-muted-foreground">{user?.uid || "—"}</dd></div>
          </dl>
        </Card>

        <Card className="border-red-300/45 dark:border-red-500/30">
          <CardHeading title="Danger zone" description="Permanent account deletion is not available in this frontend-only update." icon={<ShieldAlert size={17}/>}/>
          <div className="space-y-3 p-5 sm:p-6"><p className="text-xs leading-relaxed text-muted-foreground">Deleting an account must also remove its connected wallets, portfolio records and preferences. That requires coordinated backend deletion before a confirmation control can be enabled.</p><button type="button" disabled className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted px-3.5 py-2 text-sm font-medium text-muted-foreground opacity-65" title="Requires backend deletion support"><ShieldAlert size={15}/> Delete account — unavailable</button></div>
        </Card>
      </div>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground"><span><ShieldCheck size={13} className="mr-1 inline"/> Profile changes use Firebase Authentication.</span><Link href="/dashboard/portfolio" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">View your portfolio <ArrowRight size={13}/></Link></footer>
  </main>;
}
