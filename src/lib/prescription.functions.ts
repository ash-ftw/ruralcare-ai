import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const RxInput = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
});

const RxSchema = z.object({
  doctor: z.string().nullable(),
  hospital: z.string().nullable(),
  raw_text: z.string(),
  medicines: z.array(
    z.object({
      medicine: z.string(),
      dosage: z.string().nullable(),
      frequency: z.string().nullable(),
      duration: z.string().nullable(),
    }),
  ),
});

export const digitizePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RxInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "You extract structured prescription data from photos of handwritten or printed Indian medical prescriptions. Return strict JSON per schema. Leave fields null if not visible. Never invent dosages.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract every prescribed medicine with dosage, frequency, and duration." },
            { type: "image", image: data.imageDataUrl },
          ],
        },
      ],
      experimental_output: Output.object({ schema: RxSchema }),
    });

    return experimental_output;
  });