import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const TriageInput = z.object({
  symptoms: z.string().min(3).max(2000),
  language: z.enum(["en", "hi", "ta"]).default("en"),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.string().optional(),
  history: z.string().optional(),
});

const TriageSchema = z.object({
  symptoms: z.array(z.string()),
  possible_conditions: z.array(z.object({ name: z.string(), likelihood: z.number().min(0).max(1) })),
  risk_level: z.enum(["green", "yellow", "orange", "red", "critical"]),
  confidence: z.number().min(0).max(1),
  recommended_action: z.string(),
  red_flags: z.array(z.string()),
});

export const runTriage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TriageInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const langName = { en: "English", hi: "Hindi", ta: "Tamil" }[data.language];
    const system = `You are a careful, conservative medical triage assistant for rural primary health centers in India. You are NOT a doctor; you give preliminary triage to help health workers and patients decide next steps. Always err toward caution. Respond strictly per the schema. Write recommended_action in ${langName}, in short, simple sentences a low-literacy user can follow. Use risk_level: green=self-care, yellow=visit clinic within 1-2 days, orange=visit clinic within 24h, red=visit clinic immediately, critical=call emergency now. Include any red flags such as chest pain, breathing difficulty, stroke signs, severe bleeding, high fever in infants, pregnancy complications, poisoning, snake bite, severe dehydration.`;

    const prompt = `Patient symptoms (verbatim, may be in ${langName} or mixed): "${data.symptoms}"
Age: ${data.age ?? "unknown"}
Gender: ${data.gender ?? "unknown"}
Relevant history: ${data.history ?? "none provided"}

Produce the triage JSON.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
      experimental_output: Output.object({ schema: TriageSchema }),
    });

    return experimental_output;
  });