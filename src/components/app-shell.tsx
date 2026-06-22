import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,system-ui,sans-serif] selection:bg-primary/10 flex flex-col">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
            <div className="size-4 bg-primary-foreground rounded-sm" />
          </div>
          <span className="font-semibold tracking-tight">{t("appName")}</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-secondary rounded-full">
            <div className="size-1.5 bg-risk-green rounded-full" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("offlineReady")}
            </span>
          </div>
          <LanguageSwitcher />
          <button
            onClick={signOut}
            className="text-[12px] font-medium px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            {t("logout")}
          </button>
        </div>
      </nav>

      <main className="flex-1 pb-24">{children}</main>
    </div>
  );
}

export function BottomTab({
  items,
  active,
}: {
  items: { to: string; label: string }[];
  active: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-40">
      <div className="max-w-2xl mx-auto flex justify-between items-center">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1 rounded transition-opacity",
              active === i.to ? "text-primary opacity-100" : "text-foreground opacity-40",
            )}
          >
            <div className={cn("size-5 rounded-sm", active === i.to ? "bg-primary" : "bg-foreground")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{i.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}