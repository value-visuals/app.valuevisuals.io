"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from "lucide-react";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { authErrorMessage } from "@/lib/auth/authErrorMessage";

type AuthMode = "signin" | "signup";
type AuthModalContextValue = {
  openAuth: (mode?: AuthMode, options?: { expired?: boolean; next?: string }) => void;
  closeAuth: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

// Next.js may render its internal /_not-found tree without the app's client
// context during static prerendering. Dialog actions are never invoked on the
// server; browser components must still have the real provider.
const serverAuthModal: AuthModalContextValue = {
  openAuth: () => {},
  closeAuth: () => {},
};

export function useAuthModal(): AuthModalContextValue {
  const value = useContext(AuthModalContext);
  if (value) return value;
  if (typeof window === "undefined") return serverAuthModal;
  throw new Error("useAuthModal must be used inside AuthModalProvider");
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [expired, setExpired] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openAuth = useCallback((next: AuthMode = "signin", options?: { expired?: boolean; next?: string }) => {
    setExpired(Boolean(options?.expired));
    // Allow only relative in-app destinations; never accept absolute/external redirects.
    setNextPage(options?.next?.startsWith("/") && !options.next.startsWith("//") ? options.next : null);
    setMode(next);
  }, []);
  const closeAuth = useCallback(() => { setMode(null); setExpired(false); setNextPage(null); }, []);
  const finishAuth = useCallback(() => {
    const destination = nextPage;
    closeAuth();
    if (destination) router.push(destination);
  }, [closeAuth, nextPage, router]);

  // Old bookmarks /signin and /signup redirect to the homepage with ?auth=...
  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("auth");
    if (requested !== "signin" && requested !== "signup") return;
    openAuth(requested, { expired: url.searchParams.get("expired") === "1" });
    url.searchParams.delete("auth");
    url.searchParams.delete("expired");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [openAuth]);

  // An invalid Firebase token must display authentication without a full-page redirect.
  useEffect(() => {
    const onExpired = () => openAuth("signin", { expired: true });
    window.addEventListener("valuevisuals:auth-required", onExpired);
    return () => window.removeEventListener("valuevisuals:auth-required", onExpired);
  }, [openAuth]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  return (
    <AuthModalContext.Provider value={{ openAuth, closeAuth }}>
      {children}
      <dialog
        ref={dialogRef}
        className="vv-auth-dialog"
        aria-label={mode === "signup" ? "Create your Value Visuals account" : "Sign in to Value Visuals"}
        onClose={closeAuth}
        onCancel={closeAuth}
        onClick={event => { if (event.target === event.currentTarget) closeAuth(); }}
      >
        {mode && <div className="vv-auth-dialog-content">
          <button type="button" className="vv-auth-close" aria-label="Close sign in dialog" onClick={closeAuth}><X size={19} /></button>
          <AuthForm key={mode} mode={mode} expired={expired} onModeChange={next => { setExpired(false); setMode(next); }} onSuccess={finishAuth} />
        </div>}
      </dialog>
    </AuthModalContext.Provider>
  );
}

function AuthForm({ mode, expired, onModeChange, onSuccess }: {
  mode: AuthMode;
  expired: boolean;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [profileWarning, setProfileWarning] = useState("");
  const registering = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setLoading(true);
    try {
      if (!registering) {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        await result.user.getIdToken();
      } else {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
        await result.user.getIdToken();
        if (interests.length) {
          try {
            const response = await authenticatedFetch("/api/user/interests", {
              method: "PUT", body: JSON.stringify({ interests }),
            });
            if (!response.ok) throw new Error("Could not save interests");
          } catch {
            setProfileWarning("Your account is ready. Market interests could not be saved right now. You can update them later in Settings.");
            router.refresh();
            return;
          }
        }
      }
      onSuccess(); // Never navigate away from the page that opened the dialog.
      router.refresh();
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setError(""); setNotice(""); setLoading(true);
    try { await sendPasswordResetEmail(auth, email.trim()); }
    catch { /* Do not reveal which addresses are registered. */ }
    finally {
      setNotice("If that address is registered, a password reset email has been sent.");
      setLoading(false);
    }
  }

  return <div className="vv-auth-form">
    <span className="enterprise-section-eyebrow">{registering ? "CREATE YOUR WORKSPACE" : "YOUR WORKSPACE"}</span>
    <h2 className="vv-auth-heading">{registering ? "Join Value Visuals." : "Welcome back."}</h2>
    <p className="vv-auth-description">{registering ? "Markets are public. Your portfolio, wallets and preferences stay private." : "Access your portfolio, wallets and personal market research."}</p>
    {expired && !registering && <p role="status" className="auth-notice">Your session expired. Please sign in again.</p>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    {notice && <p role="status" className="auth-notice">{notice}</p>}
    {profileWarning ? <div role="status" className="auth-notice">
      {profileWarning}
      <button type="button" className="vv-auth-continue" onClick={onSuccess}>Continue browsing <ArrowRight size={15} /></button>
    </div> : <form onSubmit={submit} className="vv-auth-fields">
      {registering && <label className="vv-auth-label">Name
        <span className="auth-field"><UserRound size={18} /><input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Your name" required maxLength={100}/></span>
      </label>}
      <label className="vv-auth-label">Email address
        <span className="auth-field"><Mail size={18}/><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required autoFocus/></span>
      </label>
      <label className="vv-auth-label">Password
        <span className="auth-field"><LockKeyhole size={18}/><input type={visible ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "At least 8 characters" : "Your password"} required minLength={registering ? 8 : undefined}/><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
      </label>
      {registering ? <fieldset className="vv-auth-interests"><legend>Markets you follow <span>(optional)</span></legend><div>{(["bitcoin", "ethereum", "monero", "gold", "silver"] as const).map(item => <label className={`vv-interest-chip ${interests.includes(item) ? "active" : ""}`} key={item}><input type="checkbox" className="sr-only" checked={interests.includes(item)} onChange={event => setInterests(current => event.target.checked ? [...current, item] : current.filter(value => value !== item))}/><span className="capitalize">{item}</span></label>)}</div></fieldset> : <div className="vv-auth-help"><button type="button" onClick={() => void resetPassword()} disabled={loading}>Forgot password?</button></div>}
      <button className="btn-primary vv-auth-submit" disabled={loading} type="submit">{loading ? registering ? "Creating account…" : "Signing in…" : registering ? "Create account" : "Sign in"}<ArrowRight size={16}/></button>
    </form>}
    <p className="vv-auth-switch">{registering ? "Already registered?" : "New to Value Visuals?"} <button type="button" onClick={() => onModeChange(registering ? "signin" : "signup")}>{registering ? "Sign in" : "Create an account"}</button></p>
    <p className="vv-auth-note">Market prices remain accessible without an account.</p>
  </div>;
}
