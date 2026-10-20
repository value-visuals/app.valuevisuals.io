"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { authErrorMessage } from "@/lib/auth/authErrorMessage";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [profileWarning, setProfileWarning] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
      await result.user.getIdToken();
      // Preserve the existing interests API. The password is never forwarded.
      if (interests.length) {
        try {
          const response = await authenticatedFetch("/api/user/interests", {
            method: "PUT",
            body: JSON.stringify({ interests }),
          });
          if (!response.ok) throw new Error("Interest settings could not be saved");
        } catch {
          setProfileWarning("Your Firebase account was created. Market interests could not be saved to the existing profile service yet. You can set them later in Settings.");
          return;
        }
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setError(authErrorMessage(error, "signup"));
    } finally { setLoading(false); }
  }

  return (
    <main className="auth-scene px-4 py-14 sm:py-20">
      <div className="auth-panel">
        <div className="mb-8"><span className="eyebrow">START TRACKING</span><h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your workspace.</h1><p className="mt-2 text-sm text-muted-foreground">Your market data stays public. Your financial workspace stays private.</p></div>
        {error && <p role="alert" className="auth-error">{error}</p>}
        {profileWarning && <div role="status" className="auth-notice">{profileWarning} <Link className="underline" href="/dashboard">Continue to dashboard</Link></div>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Name<div className="auth-field mt-2"><UserRound size={18}/><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your name" required maxLength={100}/></div></label>
          <label className="block text-sm font-medium">Email address<div className="auth-field mt-2"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>
          <label className="block text-sm font-medium">Password<div className="auth-field mt-2"><LockKeyhole size={18}/><input type={visible?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" required minLength={8}/><button type="button" aria-label={visible?"Hide password":"Show password"} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Markets you follow <span className="text-muted-foreground font-normal">(optional)</span></legend><div className="flex flex-wrap gap-2">{(["bitcoin", "ethereum", "monero", "gold", "silver"] as const).map(item => <label key={item} className={`vv-interest-chip ${interests.includes(item)?"active":""}`}><input type="checkbox" className="sr-only" checked={interests.includes(item)} onChange={event=>setInterests(current=>event.target.checked?[...current,item]:current.filter(v=>v!==item))}/><span className="capitalize">{item}</span></label>)}</div></fieldset>
          <button className="btn-primary w-full justify-center" disabled={loading || !!profileWarning} type="submit">{loading?"Creating account…":"Create account"}<ArrowRight size={16}/></button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href="/signin" className="font-semibold text-foreground hover:underline">Sign in</Link></p>
        <p className="mt-4 text-center text-xs text-muted-foreground">Only Firebase Authentication handles your credentials.</p>
      </div>
    </main>
  );
}
