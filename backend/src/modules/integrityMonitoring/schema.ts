import { z } from "zod";

export const proctoringFrameSchema = z.object({
  cheatProbability: z.number().min(0).max(1),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  details: z.string(),
});

export const editorTelemetrySchema = z.object({
  eventType: z.string(),
  payload: z.any().optional(),
});

export const focusEventSchema = z.object({
  eventType: z.string(),
});

export const autoLogoutSchema = z.object({
  reason: z.string().default("idle_timeout"),
});
