import { prisma } from "../../config/db";
import { NotFoundError, ForbiddenError } from "../../lib/apiError";

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

export async function getQuestions(examIdOrTestId: string, userId?: string) {
  const exam = await prisma.exam.findFirst({
    where: {
      OR: [{ id: examIdOrTestId }, { testId: examIdOrTestId }],
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      seatingPlan: true,
    },
  });

  if (!exam) {
    throw new NotFoundError("Examination not found", "EXAM_NOT_FOUND");
  }

  // If no user context provided (e.g. system check), return raw list
  if (!userId) {
    return {
      examId: exam.id,
      testId: exam.testId || exam.id,
      title: exam.title,
      questions: exam.questions,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  // If ADMIN / Instructor, allow full preview without seating restriction or time restriction
  if (user.role === "ADMIN") {
    return {
      examId: exam.id,
      testId: exam.testId || exam.id,
      title: exam.title,
      questions: exam.questions,
      role: "ADMIN",
    };
  }

  // REQUIREMENT 2 & 3: Strict Examination Time-Gating & Early Entry Rules
  // Students can begin the test starting 1 minute before scheduled startTime
  const now = new Date();
  const startTime = new Date(exam.startTime);
  const endTime = new Date(exam.endTime);
  const earlyEntryAllowedTime = new Date(startTime.getTime() - 60 * 1000);

  if (now.getTime() < earlyEntryAllowedTime.getTime()) {
    const formattedStartTime = startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    throw new ForbiddenError(
      `Test has not started yet. Opens at ${formattedStartTime} (Entry opens 1 minute prior).`,
      "TIME_GATE_EARLY"
    );
  }

  if (now.getTime() > endTime.getTime()) {
    throw new ForbiddenError(
      "This examination session has concluded and is no longer accepting submissions.",
      "TIME_GATE_EXPIRED"
    );
  }

  // REQUIREMENT 1.6:
  // "and if a student who isnt there in the seating plan, he shouldnt be allowed to write the test"
  const candidateRoll = (user.rollNumber || "").trim().toUpperCase();
  if (!candidateRoll) {
    throw new ForbiddenError(
      "Your student profile does not have a registered Roll Number. You are not allowed to write this examination.",
      "NO_ROLL_NUMBER"
    );
  }

  const seatAssignment = exam.seatingPlan.find(
    (s) => s.rollNumber.trim().toUpperCase() === candidateRoll
  );

  if (!seatAssignment) {
    throw new ForbiddenError(
      `Candidate roll number "${candidateRoll}" is not present in the physical seating plan for this test. You are not authorized to write this examination.`,
      "SEATING_PLAN_EXCLUSION"
    );
  }

  // REQUIREMENT 1.6:
  // "we need to make sure to shuffle the questions based on the seating arrangement, i.e. whenever the student logs in to the test he should automatically get a set which is shuffled compared to his neighbours"
  let orderedQuestions = [...exam.questions];
  const assignedOrder = seatAssignment.questionOrder as string[] | null;

  if (assignedOrder && Array.isArray(assignedOrder) && assignedOrder.length > 0) {
    const questionMap = new Map(exam.questions.map((q) => [q.id, q]));
    const reordered: typeof exam.questions = [];
    for (const qId of assignedOrder) {
      const q = questionMap.get(qId);
      if (q) reordered.push(q);
    }
    // Append any newly added questions that might not be in the snapshot order
    for (const q of exam.questions) {
      if (!reordered.some((item) => item.id === q.id)) {
        reordered.push(q);
      }
    }
    orderedQuestions = reordered;
  }

  // Sanitize candidate questions: hide correctAnswer and sampleAnswer
  const sanitizedQuestions = orderedQuestions.map((q) => {
    const meta = (q.metadata as Record<string, unknown>) || {};
    const sanitizedMeta = { ...meta };
    delete sanitizedMeta.correctAnswer;
    delete sanitizedMeta.correctAnswers;
    delete sanitizedMeta.sampleAnswer;
    delete sanitizedMeta.rubric;

    return {
      id: q.id,
      examId: q.examId,
      content: q.content,
      type: q.type,
      metadata: sanitizedMeta,
    };
  });

  return {
    examId: exam.id,
    testId: exam.testId || exam.id,
    title: exam.title,
    seatRow: seatAssignment.seatRow,
    seatCol: seatAssignment.seatCol,
    questionSetId: seatAssignment.questionSetId || "SET-A",
    questions: sanitizedQuestions,
  };
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

export async function getSessionConfig(examIdOrTestId: string, userId: string) {
  const exam = await prisma.exam.findFirst({
    where: {
      OR: [{ id: examIdOrTestId }, { testId: examIdOrTestId }],
    },
    include: {
      accommodations: { where: { userId } },
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }

  const accommodation = exam.accommodations[0];
  const extraTime = accommodation?.extraTimeSec ?? 0;
  const baseDurationSec = exam.duration * 60;

  const now = new Date();
  const startTime = new Date(exam.startTime);
  const endTime = new Date(exam.endTime);
  const earlyOpensAt = new Date(startTime.getTime() - 60 * 1000);

  const isEarly = now.getTime() < earlyOpensAt.getTime();
  const isExpired = now.getTime() > endTime.getTime();
  const canEnter = !isEarly && !isExpired;
  const secondsUntilOpen = isEarly ? Math.max(0, Math.ceil((earlyOpensAt.getTime() - now.getTime()) / 1000)) : 0;

  return {
    examId: exam.id,
    testId: exam.testId || exam.id,
    title: exam.title,
    description: exam.description,
    location: exam.location,
    durationMinutes: exam.duration,
    startTime: exam.startTime,
    endTime: exam.endTime,
    idleTimeoutSec: exam.idleTimeoutSec,
    totalDurationSec: baseDurationSec + extraTime,
    extraTimeSec: extraTime,
    serverTime: now.toISOString(),
    earlyOpensAt: earlyOpensAt.toISOString(),
    isEarly,
    isExpired,
    canEnter,
    secondsUntilOpen,
  };
}
