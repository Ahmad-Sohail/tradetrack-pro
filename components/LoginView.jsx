"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, TrendingUp, UserPlus } from "lucide-react";
import { Button, Callout, Card, CardBody, Input, ThemeToggleButton, toast } from "@neuctra/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTheme } from "@/app/contexts/ThemeContext";

export default function LoginView() {
  const { user, loading, login, register } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState(0);
  const [v, setV] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errs, setErrs] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) router.replace(user.role === "admin" ? "/dashboard" : "/portal"); }, [loading, user, router]);
  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrs((x) => ({ ...x, [k]: undefined })); setFormError(""); };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (mode === 1 && v.name.trim().length < 2) e.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email address.";
    if (!v.password) e.password = "Enter your password.";
    else if (mode === 1 && v.password.length < 8) e.password = "Use at least 8 characters.";
    if (mode === 1 && v.confirm !== v.password) e.confirm = "Passwords do not match.";
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true); setFormError("");
    try {
      const u = mode === 0 ? await login(v.email, v.password) : await register(v.name, v.email, v.password);
      toast.success(`Welcome, ${u.name.split(" ")[0]}`);
      router.replace(u.role === "admin" ? "/dashboard" : "/portal");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrs(err.fields);
      setFormError(err.message); setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-border bg-card p-12 lg:flex" aria-label="About TradeTrack Pro">
        <div className="flex items-center gap-2 text-foreground"><TrendingUp className="size-6 text-primary" aria-hidden="true" /><span className="text-base font-semibold">TradeTrack Pro</span></div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-foreground text-balance">Every client, every trade, in one place.</h2>
          <p className="mt-4 max-w-md text-base text-secondary text-pretty">Record trading activity, track profit and loss, and talk to each client privately. TradeTrack Pro records and analyzes trades. It never places orders.</p>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />Clients only ever see their own records.</p>
      </section>
      <main className="relative flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="absolute right-4 top-4"><ThemeToggleButton context={theme} /></div>
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 text-foreground lg:hidden"><TrendingUp className="size-5 text-primary" aria-hidden="true" /><span className="text-base font-semibold">TradeTrack Pro</span></div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{mode === 0 ? "Sign in to your dashboard" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-secondary">{mode === 0 ? "Admins manage clients and trades. Clients view their own performance." : "Registered accounts get a client portal. Your manager records your trades."}</p>
          <div className="mt-6 grid grid-cols-2 gap-2" role="group" aria-label="Choose sign in or register">{["Sign in", "Register"].map((l, i) => <Button key={l} type="button" variant={mode === i ? "secondary" : "ghost"} aria-pressed={mode === i} onClick={() => { setMode(i); setErrs({}); setFormError(""); }}>{l}</Button>)}</div>
          <Card className="mt-6"><CardBody>
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              {formError && <Callout type="error" title={mode === 0 ? "Could not sign in" : "Could not register"}><p className="text-sm">{formError}</p></Callout>}
              {mode === 1 && <Input label="Full name" required placeholder="e.g. Jordan Lee" value={v.name} error={errs.name} onChange={set("name")} autoComplete="name" />}
              <Input label="Email" required type="email" placeholder="you@example.com" value={v.email} error={errs.email} onChange={set("email")} autoComplete="email" />
              <Input label="Password" required type="password" placeholder={mode === 0 ? "Your password" : "At least 8 characters"} value={v.password} error={errs.password} onChange={set("password")} autoComplete={mode === 0 ? "current-password" : "new-password"} />
              {mode === 1 && <Input label="Confirm password" required type="password" placeholder="Repeat your password" value={v.confirm} error={errs.confirm} onChange={set("confirm")} autoComplete="new-password" />}
              <Button type="submit" fullWidth size="lg" loading={busy} loadingText={mode === 0 ? "Signing in" : "Creating account"} iconBefore={mode === 0 ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}>{mode === 0 ? "Sign in" : "Create account"}</Button>
            </form>
          </CardBody></Card>
        </div>
      </main>
    </div>
  );
}
