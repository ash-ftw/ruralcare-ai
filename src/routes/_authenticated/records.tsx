import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RiskBadge } from "@/components/risk-badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/records")({
  component: Records,
});

function Records() {
  const { user } = useAuth();
  const { t } = useI18n();

  const { data: patient } = useQuery({
    queryKey: ["self-patient", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["all-visits", patient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visits")
        .select("*")
        .eq("patient_id", patient!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!patient,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["all-rx", patient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", patient!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!patient,
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">My health record</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All your triages and digitized prescriptions in one place.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Visits ({visits.length})
          </h2>
          {visits.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 bg-card border border-border rounded-xl text-center">
              {t("noVisits")} <Link to="/triage" className="text-primary font-semibold">Start triage</Link>
            </p>
          )}
          {visits.map((v: any) => (
            <div key={v.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold">
                    {(v.possible_conditions?.[0]?.name as string) ?? "Symptom check"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(v.created_at), "d MMM yyyy, HH:mm")} • #{v.id.slice(0, 6)}
                  </p>
                </div>
                <RiskBadge level={v.risk_level} />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{v.recommended_action}</p>
              {v.symptoms?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {(v.symptoms as string[]).map((s) => (
                    <span key={s} className="text-[11px] px-2 py-0.5 bg-secondary rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Prescriptions ({prescriptions.length})
          </h2>
          {prescriptions.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 bg-card border border-border rounded-xl text-center">
              No prescriptions saved. <Link to="/scan" className="text-primary font-semibold">Scan one</Link>
            </p>
          )}
          {prescriptions.map((p: any) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">{p.doctor ?? "Prescription"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.hospital ?? "—"} • {format(new Date(p.created_at), "d MMM yyyy")}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-border mt-2">
                {(p.medicines as any[]).map((m, i) => (
                  <div key={i} className="py-2 grid grid-cols-4 gap-2 text-sm">
                    <span className="col-span-2 font-medium">{m.medicine}</span>
                    <span className="text-muted-foreground">{m.dosage ?? "—"}</span>
                    <span className="text-muted-foreground text-right">{m.frequency ?? ""} {m.duration ? `• ${m.duration}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}