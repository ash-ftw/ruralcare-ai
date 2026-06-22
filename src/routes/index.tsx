import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SWASTHA — Rural AI Health Assistant" },
      { name: "description", content: "Voice-first AI triage, prescription digitization, and health records for rural primary health centers." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/home" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,system-ui,sans-serif]">
      <nav className="px-4 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
            <div className="size-4 bg-primary-foreground rounded-sm" />
          </div>
          <span className="font-semibold tracking-tight">{t("appName")}</span>
        </div>
        <LanguageSwitcher />
      </nav>

      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary rounded-full mb-8">
          <div className="size-1.5 bg-risk-green rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("offlineReady")}
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
          AI health triage for every village.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto text-pretty">
          Describe symptoms in your own language. Get a clear risk level, a recommended next step, and a record your health worker can act on.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition"
          >
            {t("signin")}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="px-6 py-3 border border-border rounded-xl font-semibold hover:bg-secondary transition"
          >
            {t("signup")}
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-20 text-left">
          <Feature title="Voice triage" body="Speak symptoms in English, Hindi, or Tamil. AI extracts red flags and assigns a risk level." />
          <Feature title="Prescription scan" body="Snap a paper Rx — get structured medicines, dosage, frequency, duration." />
          <Feature title="Clinic dashboard" body="Workers see queued patients. Admins watch disease trends across villages." />
        </div>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-5 bg-card border border-border rounded-2xl">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
