import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { runTriage } from "@/lib/triage.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RiskBadge } from "@/components/risk-badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/triage")({
  component: TriagePage,
});

type Triage = {
  symptoms: string[];
  possible_conditions: { name: string; likelihood: number }[];
  risk_level: string;
  confidence: number;
  recommended_action: string;
  red_flags: string[];
};

function TriagePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Triage | null>(null);
  const [saving, setSaving] = useState(false);
  const recRef = useRef<any>(null);

  const fetchTriage = useServerFn(runTriage);

  function toggleListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice not supported in this browser. Please type.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let s = "";
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText((prev) => (prev ? prev + " " : "") + s);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    r.start();
    setListening(true);
  }

  async function analyze() {
    if (text.trim().length < 3) return;
    setBusy(true);
    setResult(null);
    try {
      const r = (await fetchTriage({ data: { symptoms: text, language: lang } })) as Triage;
      setResult(r);
    } catch (e: any) {
      toast.error(e.message ?? "Could not run triage");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result || !user) return;
    setSaving(true);
    try {
      // ensure patient row exists
      let { data: patient } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!patient) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,village,phone")
          .eq("id", user.id)
          .maybeSingle();
        const ins = await supabase
          .from("patients")
          .insert({
            user_id: user.id,
            full_name: prof?.full_name || "Patient",
            village: prof?.village,
            phone: prof?.phone,
          })
          .select("*")
          .single();
        patient = ins.data;
      }
      const { data: visit, error } = await supabase
        .from("visits")
        .insert({
          patient_id: patient!.id,
          symptoms_raw: text,
          symptoms: result.symptoms,
          possible_conditions: result.possible_conditions,
          risk_level: result.risk_level as any,
          confidence: result.confidence,
          recommended_action: result.recommended_action,
          red_flags: result.red_flags,
          language: lang,
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      if (["orange", "red", "critical"].includes(result.risk_level)) {
        await supabase.from("alerts").insert({
          patient_id: patient!.id,
          visit_id: visit.id,
          risk_level: result.risk_level as any,
          message: result.recommended_action,
        });
      }
      toast.success(t("saved"));
      navigate({ to: "/records" });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => () => recRef.current?.stop?.(), []);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("describe")}</h1>

        <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={t("placeholderExample")}
            className="w-full p-3 bg-background border border-border rounded-xl text-base resize-none focus:outline-none focus:border-primary"
          />
          <div className="flex gap-3">
            <button
              onClick={toggleListen}
              className={
                "flex-1 py-3 rounded-xl font-semibold transition " +
                (listening
                  ? "bg-risk-red text-white animate-pulse"
                  : "bg-primary text-primary-foreground")
              }
            >
              {listening ? t("listening") : t("tapToSpeak")}
            </button>
            <button
              onClick={analyze}
              disabled={busy || text.trim().length < 3}
              className="px-5 py-3 bg-foreground text-background rounded-xl font-semibold disabled:opacity-50"
            >
              {busy ? "…" : t("analyze")}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("riskLevel")}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <RiskBadge level={result.risk_level} className="text-xs px-3 py-1" />
                  <span className="text-sm text-muted-foreground">
                    {t("confidence")} {Math.round(result.confidence * 100)}%
                  </span>
                </div>
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "…" : t("saveVisit")}
              </button>
            </div>

            <Section title={t("action")}>
              <p className="text-base">{result.recommended_action}</p>
            </Section>

            {result.red_flags.length > 0 && (
              <Section title={t("redFlags")}>
                <ul className="space-y-1">
                  {result.red_flags.map((f) => (
                    <li key={f} className="text-sm text-risk-red flex gap-2">
                      <span>▲</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title={t("possible")}>
              <div className="space-y-2">
                {result.possible_conditions.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 text-sm">
                    <span className="flex-1">{c.name}</span>
                    <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.round(c.likelihood * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                      {Math.round(c.likelihood * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
              This is AI-assisted triage, not a medical diagnosis. Always confirm with a qualified clinician.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}