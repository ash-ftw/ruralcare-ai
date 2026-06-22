import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { RiskBadge } from "@/components/risk-badge";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, loading } = useRoles(user);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: patients }, { count: visitsToday }, { count: highRisk }] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase
          .from("visits")
          .select("*", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase
          .from("alerts")
          .select("*", { count: "exact", head: true })
          .eq("acknowledged", false),
      ]);
      return { patients: patients ?? 0, visitsToday: visitsToday ?? 0, highRisk: highRisk ?? 0 };
    },
    enabled: isAdmin,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["admin-visits"],
    queryFn: async () => {
      const since = subDays(new Date(), 14).toISOString();
      const { data } = await supabase
        .from("visits")
        .select("created_at,risk_level,possible_conditions")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*, patients(full_name,village)")
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  if (!loading && !isAdmin) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto p-8 text-center">
          <p>Clinic admin access required.</p>
        </div>
      </AppShell>
    );
  }

  // Bucket by day for chart
  const days: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const key = format(d, "MMM d");
    const count = visits.filter(
      (v: any) => format(new Date(v.created_at), "MMM d") === key,
    ).length;
    days.push({ day: key, count });
  }

  // Top conditions
  const conditionCounts: Record<string, number> = {};
  for (const v of visits as any[]) {
    const c = v.possible_conditions?.[0]?.name;
    if (c) conditionCounts[c] = (conditionCounts[c] ?? 0) + 1;
  }
  const topConditions = Object.entries(conditionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin")} dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Disease trends, alerts, and clinic health metrics.</p>
        </header>

        <div className="grid grid-cols-3 gap-4">
          <Kpi label={t("totalPatients")} value={stats?.patients ?? 0} />
          <Kpi label={t("visitsToday")} value={stats?.visitsToday ?? 0} />
          <Kpi label={t("highRiskOpen")} value={stats?.highRisk ?? 0} tone="risk" />
        </div>

        <section className="bg-card border border-border rounded-3xl p-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground mb-4">
            {t("diseaseTrends")}
          </h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={days}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-card border border-border rounded-3xl p-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground mb-4">
            Top conditions (14d)
          </h2>
          {topConditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          ) : (
            <div className="space-y-2">
              {topConditions.map(([c, n]) => (
                <div key={c} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{c}</span>
                  <div className="w-40 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(n / (topConditions[0][1] || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground w-8 text-right">{n}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Recent alerts</h2>
          {alerts.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 bg-card border border-border rounded-xl text-center">
              No alerts.
            </p>
          )}
          {alerts.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <RiskBadge level={a.risk_level} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{a.patients?.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.patients?.village} • {format(new Date(a.created_at), "d MMM HH:mm")}
                </p>
                <p className="text-sm mt-1">{a.message}</p>
              </div>
              {a.acknowledged ? (
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Ack</span>
              ) : (
                <span className="text-[10px] font-bold uppercase text-risk-red">Open</span>
              )}
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "risk" }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={"text-3xl font-semibold mt-2 " + (tone === "risk" ? "text-risk-red" : "")}>
        {value}
      </p>
    </div>
  );
}