import { z } from "zod";

export const proctoringFrameSchema = z.object({
  cheatProbability: z.number().min(0).max(1),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  details: z.string(),
});

export const editorTelemetrySchema = z.object({
  eventType: z.enum(["keystroke", "paste", "run", "submit"]),
  payload: z.any(),
});

export const focusEventSchema = z.object({
  eventType: z.enum(["blur", "focus", "visibility_hidden"]),
});

export const autoLogoutSchema = z.object({
  reason: z.string().default("idle_timeout"),
});
