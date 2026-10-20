"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, ArrowRight } from "lucide-react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/auth/authErrorMessage";

export default function SignInPage() {
  return <Suspense fallback={<div className="min-h-[75vh]" />}><SignInForm /></Suspense>;
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      // Await a usable ID token before rendering pages that fetch protected data.
      await credential.user.getIdToken();
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(authErrorMessage(cause, "signin"));
    } finally { setLoading(false); }
  }

  async function resetPassword() {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setError(""); setNotice(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice("If that address is registered, a reset email has been sent.");
    } catch {
      setNotice("If that address is registered, a reset email has been sent.");
    } finally { setLoading(false); }
  }

  return (
    <main className="auth-scene px-4 py-14 sm:py-20">
      <div className="auth-panel">
        <div className="mb-8"><span className="eyebrow">YOUR WORKSPACE</span><h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back.</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to access your portfolio, wallets and preferences.</p></div>
        {params.get("expired") === "1" && <p className="auth-notice">Your session needs to be renewed.</p>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        {notice && <p role="status" className="auth-notice">{notice}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Email address<div className="auth-field mt-2"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>
          <label className="block text-sm font-medium">Password<div className="auth-field mt-2"><LockKeyhole size={18}/><input type={visible?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" aria-label={visible?"Hide password":"Show password"} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          <div className="flex justify-end"><button className="text-xs font-medium text-primary hover:underline" type="button" onClick={resetPassword} disabled={loading}>Forgot password?</button></div>
          <button className="btn-primary w-full justify-center" disabled={loading} type="submit">{loading?"Signing in…":"Sign in"}<ArrowRight size={16}/></button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">New to Value Visuals? <Link href="/signup" className="font-semibold text-foreground hover:underline">Create an account</Link></p>
        <p className="mt-4 text-center text-xs text-muted-foreground">Market prices are public. <Link href="/" className="underline underline-offset-4">Explore without signing in</Link></p>
      </div>
    </main>
  );
}
