import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  green: "bg-risk-green text-white",
  yellow: "bg-risk-amber text-white",
  amber: "bg-risk-amber text-white",
  orange: "bg-risk-orange text-white",
  red: "bg-risk-red text-white",
  critical: "bg-risk-red text-white ring-2 ring-risk-red/40",
};

const labels: Record<string, string> = {
  green: "Healthy",
  yellow: "Mild",
  amber: "Mild",
  orange: "Moderate",
  red: "High Risk",
  critical: "Critical",
};

export function RiskBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider whitespace-nowrap",
        styles[level] ?? "bg-muted text-foreground",
        className,
      )}
    >
      {labels[level] ?? level}
    </span>
  );
}