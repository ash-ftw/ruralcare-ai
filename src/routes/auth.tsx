import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode = "signin" } = useSearch({ from: "/auth" });
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"patient" | "health_worker" | "clinic_admin">("patient");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role, preferred_language: lang },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/home" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,system-ui,sans-serif] flex flex-col">
      <nav className="px-4 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-3">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
            <div className="size-4 bg-primary-foreground rounded-sm" />
          </div>
          <span className="font-semibold tracking-tight">{t("appName")}</span>
        </Link>
        <LanguageSwitcher />
      </nav>
      <main className="flex-1 grid place-items-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSignup ? t("signup") : t("signin")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignup ? "Choose your role to get the right experience." : "Welcome back."}
            </p>
          </div>

          {isSignup && (
            <>
              <Field label={t("fullName")}>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label={t("role")}>
                <div className="grid grid-cols-3 gap-2">
                  {(["patient", "health_worker", "clinic_admin"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRole(r)}
                      className={
                        "text-xs font-semibold px-2 py-2 rounded-lg border transition " +
                        (role === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary")
                      }
                    >
                      {t(r === "patient" ? "patient" : r === "health_worker" ? "healthWorker" : "clinicAdmin")}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label={t("email")}>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label={t("password")}>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </Field>

          <button
            disabled={busy}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/20 disabled:opacity-60"
          >
            {busy ? "…" : isSignup ? t("signup") : t("signin")}
          </button>

          <button
            type="button"
            className="w-full text-sm text-primary font-medium"
            onClick={() => setIsSignup((v) => !v)}
          >
            {isSignup ? "Have an account? Sign in" : "New here? Create account"}
          </button>
        </form>
      </main>

      <style>{`.input{width:100%;padding:.65rem .85rem;border:1px solid var(--border);border-radius:.65rem;background:var(--background);font-size:.95rem;outline:none}.input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--ring)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}