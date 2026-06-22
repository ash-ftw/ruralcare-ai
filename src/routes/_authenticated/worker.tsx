import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { RiskBadge } from "@/components/risk-badge";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/worker")({
  component: WorkerPage,
});

function WorkerPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isWorker, isAdmin, loading } = useRoles(user);
  const qc = useQueryClient();

  const { data: patients = [] } = useQuery({
    queryKey: ["all-patients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("*, visits(risk_level,created_at)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isWorker || isAdmin,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["active-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*, patients(full_name,village)")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: isWorker || isAdmin,
  });

  if (!loading && !isWorker && !isAdmin) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto p-8 text-center">
          <p>You need health worker access to view this page.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("patientQueue")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {patients.length} registered • {alerts.length} {t("activeAlerts")}
            </p>
          </div>
          <RegisterPatientButton onDone={() => qc.invalidateQueries({ queryKey: ["all-patients"] })} />
        </header>

        {alerts.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {t("activeAlerts")}
            </h2>
            <div className="space-y-2">
              {alerts.map((a: any) => (
                <div
                  key={a.id}
                  className="bg-risk-red/5 border border-risk-red/20 rounded-xl p-4 flex items-start gap-3"
                >
                  <RiskBadge level={a.risk_level} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{a.patients?.full_name ?? "Patient"}</p>
                    <p className="text-sm text-foreground/80 mt-0.5">{a.message}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from("alerts").update({ acknowledged: true }).eq("id", a.id);
                      qc.invalidateQueries({ queryKey: ["active-alerts"] });
                    }}
                    className="text-xs font-semibold text-primary"
                  >
                    Ack
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Patients</h2>
          {patients.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 bg-card border border-border rounded-xl text-center">
              No patients yet. Register the first one.
            </p>
          )}
          <div className="space-y-2">
            {patients.map((p: any) => {
              const last = p.visits?.[0];
              return (
                <Link
                  key={p.id}
                  to="/triage"
                  className="block bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{p.full_name}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{p.id.slice(0, 4)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.age ? `Age ${p.age}` : ""} {p.gender ? `• ${p.gender}` : ""} {p.village ? `• ${p.village}` : ""}
                    </p>
                  </div>
                  {last && <RiskBadge level={last.risk_level} />}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function RegisterPatientButton({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [village, setVillage] = useState("");
  const [phone, setPhone] = useState("");
  const { t } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("patients").insert({
      full_name: name,
      age: age ? Number(age) : null,
      gender: gender || null,
      village: village || null,
      phone: phone || null,
      registered_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Patient registered");
    setOpen(false);
    setName("");
    setAge("");
    setGender("");
    setVillage("");
    setPhone("");
    onDone();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
      >
        + {t("addPatient")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full max-w-md bg-card border border-border rounded-3xl p-6 space-y-3"
          >
            <h3 className="text-lg font-semibold">{t("addPatient")}</h3>
            <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background" />
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background">
                <option value="">Gender</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="O">Other</option>
              </select>
            </div>
            <input placeholder="Village" value={village} onChange={(e) => setVillage(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
            <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 border border-border rounded-lg font-medium">
                Cancel
              </button>
              <button className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-semibold">
                Register
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}