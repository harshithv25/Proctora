import { z } from "zod";

export const autosaveSchema = z.object({
  answers: z.any(),
});

export const submitSchema = z.object({
  answers: z.any(),
  submittedVia: z.enum(["manual", "timer_expiry", "auto_logout"]).default("manual"),
});

export const candidateQuerySchema = z.object({
  query: z.string().min(1, "Query cannot be empty").max(1000, "Query is too long"),
  category: z.string().optional().default("general"),
  questionId: z.string().optional().nullable(),
});

export const respondQuerySchema = z.object({
  response: z.string().min(1, "Response cannot be empty").max(1000, "Response is too long"),
  status: z.enum(["pending", "in_review", "answered", "resolved"]).default("answered"),
});
