import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const opts: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "HI" },
  { code: "ta", label: "தமிழ்" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={o.code}
          onClick={() => setLang(o.code)}
          className={cn(
            "text-[13px] font-medium px-2 py-1 rounded transition-colors",
            lang === o.code ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}