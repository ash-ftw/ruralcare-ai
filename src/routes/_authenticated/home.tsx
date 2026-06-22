import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RiskBadge } from "@/components/risk-badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/home")({
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const { isWorker, isAdmin, loading: rolesLoading } = useRoles(user);
  const { t } = useI18n();
  const navigate = useNavigate();

  // Auto-redirect staff to their dashboards
  if (!rolesLoading && (isWorker || isAdmin)) {
    if (isAdmin) {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/worker" });
    }
  }

  return (
    <AppShell>
      <PatientHome />
    </AppShell>
  );
}

function PatientHome() {
  const { user } = useAuth();
  const { t } = useI18n();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: patient } = useQuery({
    queryKey: ["self-patient", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["visits", patient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visits")
        .select("*")
        .eq("patient_id", patient!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!patient,
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("namaste")}, {profile?.full_name?.split(" ")[0] ?? "friend"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {profile?.village ? `Village: ${profile.village}` : "Welcome to your health record"}
        </p>
      </header>

      <Link to="/triage" className="block">
        <div className="relative group cursor-pointer bg-card border-2 border-primary/20 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-pulse" />
          <div className="relative size-20 bg-primary rounded-full flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
            <div className="w-1 h-8 bg-primary-foreground/40 rounded-full mx-0.5 animate-pulse" />
            <div className="w-1 h-12 bg-primary-foreground rounded-full mx-0.5" />
            <div className="w-1 h-8 bg-primary-foreground/40 rounded-full mx-0.5 animate-pulse" />
          </div>
          <h2 className="relative text-xl font-semibold mb-2">{t("describe")}</h2>
          <p className="relative text-muted-foreground">{t("tapToSpeak")}</p>
          <div className="relative mt-6 flex gap-2">
            <span className="px-3 py-1 bg-secondary border border-border rounded-full text-xs font-medium text-muted-foreground italic">
              {t("placeholderExample")}
            </span>
          </div>
        </div>
      </Link>

      <section className="grid grid-cols-2 gap-4">
        <a
          href="tel:108"
          className="p-5 bg-risk-red/5 border border-risk-red/20 rounded-2xl flex flex-col gap-3 active:scale-95 transition-transform"
        >
          <div className="size-10 bg-risk-red rounded-full flex items-center justify-center text-white font-bold animate-pulse">
            !
          </div>
          <span className="font-bold text-risk-red text-lg leading-tight uppercase tracking-tight">
            {t("emergencyCall")}
          </span>
        </a>
        <Link
          to="/scan"
          className="p-5 bg-card border border-border rounded-2xl flex flex-col gap-3 active:scale-95 transition-transform"
        >
          <div className="size-10 bg-secondary rounded-full flex items-center justify-center">
            <div className="size-4 border-2 border-foreground/40 rounded-sm" />
          </div>
          <span className="font-bold text-lg leading-tight uppercase tracking-tight">
            {t("uploadRx")}
          </span>
        </Link>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">
            {t("recentVisits")}
          </h3>
          <Link to="/records" className="text-[13px] font-semibold text-primary">
            {t("viewRecords")}
          </Link>
        </div>

        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6 text-center">
            {t("noVisits")}
          </p>
        ) : (
          <div className="space-y-3">
            {visits.map((v: any) => (
              <div key={v.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate">
                      {(v.possible_conditions?.[0]?.name as string) ?? "Symptom check"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tracking-tighter">
                      #{v.id.slice(0, 4)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(v.created_at), "d MMM yyyy")} • {v.recommended_action?.slice(0, 40)}
                  </p>
                </div>
                <RiskBadge level={v.risk_level} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}