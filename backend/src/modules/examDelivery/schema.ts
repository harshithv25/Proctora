import { z } from "zod";

export const deviceCheckSchema = z.object({
  browserInfo: z.string(),
  screenResolution: z.string(),
  webcamAvailable: z.boolean(),
  microphoneAvailable: z.boolean(),
});

export const fullscreenEventSchema = z.object({
  eventType: z.enum(["enter", "exit"]),
});
