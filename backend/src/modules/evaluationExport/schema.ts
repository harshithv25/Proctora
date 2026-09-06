import { z } from "zod";

export const autosaveSchema = z.object({
  answers: z.any(),
});

export const submitSchema = z.object({
  answers: z.any(),
  submittedVia: z.enum(["manual", "timer_expiry", "auto_logout"]).default("manual"),
});
