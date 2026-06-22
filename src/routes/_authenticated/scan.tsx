import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { digitizePrescription } from "@/lib/prescription.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scan")({
  component: ScanPage,
});

type Rx = {
  doctor: string | null;
  hospital: string | null;
  raw_text: string;
  medicines: { medicine: string; dosage: string | null; frequency: string | null; duration: string | null }[];
};

function ScanPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Rx | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const fetchRx = useServerFn(digitizePrescription);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function digitize() {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const r = (await fetchRx({ data: { imageDataUrl: preview } })) as Rx;
      setResult(r);
    } catch (e: any) {
      toast.error(e.message ?? "Could not digitize");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result || !user || !file) return;
    setBusy(true);
    try {
      let { data: patient } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!patient) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        const ins = await supabase
          .from("patients")
          .insert({ user_id: user.id, full_name: prof?.full_name || "Patient" })
          .select("*")
          .single();
        patient = ins.data;
      }
      const path = `${user.id}/${patient!.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("prescriptions").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("prescriptions").insert({
        patient_id: patient!.id,
        image_path: path,
        doctor: result.doctor,
        hospital: result.hospital,
        medicines: result.medicines,
        raw_text: result.raw_text,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t("saved"));
      navigate({ to: "/records" });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("scanPrescription")}</h1>

        <label className="block bg-card border-2 border-dashed border-border rounded-3xl p-8 text-center cursor-pointer hover:border-primary transition">
          <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
          {preview ? (
            <img src={preview} alt="Prescription" className="max-h-64 mx-auto rounded-xl" />
          ) : (
            <div className="text-muted-foreground">
              <div className="size-12 mx-auto bg-secondary rounded-full mb-3 grid place-items-center">
                <div className="size-5 border-2 border-foreground/40 rounded-sm" />
              </div>
              <p className="font-semibold text-foreground">{t("chooseImage")}</p>
              <p className="text-xs mt-1">JPG or PNG, up to 10 MB</p>
            </div>
          )}
        </label>

        {preview && !result && (
          <button
            onClick={digitize}
            disabled={busy}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
          >
            {busy ? "Reading…" : t("digitize")}
          </button>
        )}

        {result && (
          <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{result.doctor ?? "Doctor"}</p>
                <p className="text-xs text-muted-foreground">{result.hospital ?? "—"}</p>
              </div>
              <button
                onClick={save}
                disabled={busy}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "…" : t("saveVisit")}
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              <span className="col-span-4">{t("medicine")}</span>
              <span className="col-span-3">{t("dosage")}</span>
              <span className="col-span-3">{t("frequency")}</span>
              <span className="col-span-2">{t("duration")}</span>
            </div>
            {result.medicines.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 text-sm py-1">
                <span className="col-span-4 font-medium">{m.medicine}</span>
                <span className="col-span-3 text-muted-foreground">{m.dosage ?? "—"}</span>
                <span className="col-span-3 text-muted-foreground">{m.frequency ?? "—"}</span>
                <span className="col-span-2 text-muted-foreground">{m.duration ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}