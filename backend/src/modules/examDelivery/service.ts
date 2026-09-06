import { prisma } from "../../config/db";
import { NotFoundError } from "../../lib/apiError";

export async function deviceCheck(
  _examId: string,
  data: {
    browserInfo: string;
    screenResolution: string;
    webcamAvailable: boolean;
    microphoneAvailable: boolean;
  }
) {
  const passed = data.webcamAvailable && data.microphoneAvailable;
  return {
    passed,
    details: {
      webcam: data.webcamAvailable ? "ok" : "not detected",
      microphone: data.microphoneAvailable ? "ok" : "not detected",
      browser: data.browserInfo,
      resolution: data.screenResolution,
    },
  };
}

export async function getQuestions(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: true },
  });

  if (!exam) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }

  return exam.questions;
}

export async function logFullscreenEvent(
  examId: string,
  userId: string,
  eventType: string
) {
  return prisma.focusLog.create({
    data: {
      examId,
      userId,
      eventType: `fullscreen_${eventType}`,
    },
  });
}

export async function getSessionConfig(examId: string, userId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      accommodations: { where: { userId } },
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }

  const accommodation = exam.accommodations[0];
  const extraTime = accommodation?.extraTimeSec ?? 0;
  const baseDuration =
    (exam.endTime.getTime() - exam.startTime.getTime()) / 1000;

  return {
    examId: exam.id,
    title: exam.title,
    startTime: exam.startTime,
    endTime: exam.endTime,
    idleTimeoutSec: exam.idleTimeoutSec,
    totalDurationSec: baseDuration + extraTime,
    extraTimeSec: extraTime,
  };
}
