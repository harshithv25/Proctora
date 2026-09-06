import { prisma } from "../../config/db";
import { encrypt } from "../../lib/crypto";

export async function recordProctoringFrame(
  examId: string,
  userId: string,
  data: {
    cheatProbability: number;
    windowStart: string;
    windowEnd: string;
    details: string;
  }
) {
  const encryptedDetails = encrypt(data.details);
  const flagged = data.cheatProbability > 0.7;

  return prisma.proctoringEvent.create({
    data: {
      examId,
      userId,
      cheatProbability: data.cheatProbability,
      windowStart: new Date(data.windowStart),
      windowEnd: new Date(data.windowEnd),
      flagged,
      detailsEncrypted: encryptedDetails,
    },
  });
}

export async function recordEditorTelemetry(
  examId: string,
  userId: string,
  data: { eventType: string; payload: unknown }
) {
  return prisma.editorTelemetryEvent.create({
    data: {
      examId,
      userId,
      eventType: data.eventType,
      payload: data.payload as any,
    },
  });
}

export async function recordFocusEvent(
  examId: string,
  userId: string,
  eventType: string
) {
  return prisma.focusLog.create({
    data: { examId, userId, eventType },
  });
}

export async function getProctoringAlerts(examId: string) {
  return prisma.proctoringEvent.findMany({
    where: { examId, flagged: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function triggerAutoLogout(
  examId: string,
  userId: string,
  reason: string
) {
  await prisma.focusLog.create({
    data: {
      examId,
      userId,
      eventType: `auto_logout:${reason}`,
    },
  });

  return { message: `Auto-logout triggered for user ${userId}: ${reason}` };
}
