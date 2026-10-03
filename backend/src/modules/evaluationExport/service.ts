import { prisma } from "../../config/db";
import { AppError, NotFoundError, ForbiddenError } from "../../lib/apiError";
import { evaluateResponses, ExamEvaluationResult } from "./grading";
import { decrypt } from "../../lib/crypto";

export async function ensureExamExists(examIdentifier: string, userId = "system") {
  const existing = await prisma.exam.findFirst({
    where: {
      OR: [{ id: examIdentifier }, { testId: examIdentifier }],
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      seatingPlan: true,
    },
  });
  if (existing) return existing;

  if (examIdentifier === "demo-exam-1" || examIdentifier === "DEMO-CS101") {
    return prisma.exam.create({
      data: {
        id: "demo-exam-1",
        testId: "DEMO-CS101",
        title: "Midterm Examination: Algorithms & Data Structures",
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        idleTimeoutSec: 300,
        createdBy: userId,
      },
      include: {
        questions: { orderBy: { order: "asc" } },
        seatingPlan: true,
      },
    });
  }

  throw new NotFoundError(
    `Exam with ID or Test ID '${examIdentifier}' does not exist.`,
    "EXAM_NOT_FOUND"
  );
}

export async function autosave(
  examIdentifier: string,
  userId: string,
  answers: unknown
) {
  const exam = await ensureExamExists(examIdentifier, userId);

  // Time gating checks
  const now = new Date();
  const startTime = new Date(exam.startTime);
  const endTime = new Date(exam.endTime);
  const earlyEntryAllowedTime = new Date(startTime.getTime() - 60 * 1000);

  if (now.getTime() < earlyEntryAllowedTime.getTime()) {
    throw new ForbiddenError(
      `Test has not started yet. Opens at ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (Entry opens 1 minute prior).`,
      "TIME_GATE_EARLY"
    );
  }

  // Grace period of 5 minutes after end time for any in-flight autosave
  if (now.getTime() > endTime.getTime() + 5 * 60 * 1000) {
    throw new ForbiddenError(
      "This examination session has concluded and is no longer accepting autosaves.",
      "TIME_GATE_EXPIRED"
    );
  }

  const existing = await prisma.examResponse.findFirst({
    where: { examId: exam.id, userId },
  });

  if (existing) {
    // If candidate has already submitted their final exam, do not overwrite with draft
    if (existing.submittedVia !== "autosave") {
      return existing;
    }
    return prisma.examResponse.update({
      where: { id: existing.id },
      data: {
        answers: answers as any,
        submittedVia: "autosave",
      },
    });
  }

  return (prisma.examResponse as any).create({
    data: {
      examId: exam.id,
      userId,
      answers: answers as any,
      submittedVia: "autosave",
      startedAt: new Date(),
    },
  });
}

export async function submit(
  examIdentifier: string,
  userId: string,
  answers: unknown,
  submittedVia: string
) {
  const exam = await ensureExamExists(examIdentifier, userId);

  // Time gating check: Cannot submit before entry opens
  const now = new Date();
  const startTime = new Date(exam.startTime);
  const earlyEntryAllowedTime = new Date(startTime.getTime() - 60 * 1000);

  if (now.getTime() < earlyEntryAllowedTime.getTime()) {
    throw new ForbiddenError(
      `Test has not started yet. Opens at ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (Entry opens 1 minute prior).`,
      "TIME_GATE_EARLY"
    );
  }

  const questions = await prisma.question.findMany({
    where: { examId: exam.id },
    orderBy: { order: "asc" },
  });

  // REQUIREMENT 6: Auto-Grading Rules
  const gradingResult = evaluateResponses(questions, (answers as Record<string, any>) || {});

  const existing = await prisma.examResponse.findFirst({
    where: { examId: exam.id, userId },
  });

  if (existing) {
    return (prisma.examResponse as any).update({
      where: { id: existing.id },
      data: {
        answers: answers as any,
        score: gradingResult.totalScore,
        maxScore: gradingResult.maxScore,
        evaluationDetails: gradingResult.breakdown as any,
        submittedVia,
        submittedAt: new Date(),
      },
    });
  }

  return (prisma.examResponse as any).create({
    data: {
      examId: exam.id,
      userId,
      answers: answers as any,
      score: gradingResult.totalScore,
      maxScore: gradingResult.maxScore,
      evaluationDetails: gradingResult.breakdown as any,
      submittedVia,
      startedAt: new Date(),
      submittedAt: new Date(),
    },
  });
}

export async function exportResponses(examIdentifier: string) {
  const exam = await ensureExamExists(examIdentifier, "system");
  return prisma.examResponse.findMany({
    where: { examId: exam.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, rollNumber: true },
      },
    },
    orderBy: { submittedAt: "asc" },
  });
}

// Live Invigilation Feed & Post-Exam Analytics
export async function getExamMonitorFeed(examIdentifier: string) {
  const exam = await ensureExamExists(examIdentifier, "admin");

  const [questions, seatingAssignments, responses, focusLogs, proctorEvents, editorEvents] =
    await Promise.all([
      prisma.question.findMany({
        where: { examId: exam.id },
        orderBy: { order: "asc" },
      }),
      prisma.seatingAssignment.findMany({
        where: { examId: exam.id },
        orderBy: [{ seatRow: "asc" }, { seatCol: "asc" }],
      }),
      prisma.examResponse.findMany({
        where: { examId: exam.id },
        include: {
          user: {
            select: { id: true, name: true, email: true, rollNumber: true },
          },
        },
      }),
      prisma.focusLog.findMany({
        where: { OR: [{ examId: exam.id }, { examId: exam.testId || exam.id }] },
        include: {
          user: {
            select: { id: true, name: true, email: true, rollNumber: true },
          },
        },
        orderBy: { timestamp: "desc" },
        take: 80,
      }),
      prisma.proctoringEvent.findMany({
        where: { OR: [{ examId: exam.id }, { examId: exam.testId || exam.id }] },
        include: {
          user: {
            select: { id: true, name: true, email: true, rollNumber: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.editorTelemetryEvent.findMany({
        where: { OR: [{ examId: exam.id }, { examId: exam.testId || exam.id }] },
        orderBy: { timestamp: "desc" },
        take: 120,
      }),
    ]);

  const now = new Date();
  const startTime = new Date(exam.startTime);
  const endTime = new Date(exam.endTime);

  // Map users from roll numbers
  const rollNumbers = [...new Set(seatingAssignments.map((s) => s.rollNumber.trim().toUpperCase()))];
  const candidateUsers = await prisma.user.findMany({
    where: {
      rollNumber: { in: rollNumbers },
    },
    select: { id: true, name: true, email: true, rollNumber: true },
  });

  const userByRoll = new Map(candidateUsers.map((u) => [(u.rollNumber || "").toUpperCase(), u]));
  const responseByUserId = new Map(responses.map((r) => [r.userId, r]));

  // Check whether all assigned students submitted
  const submittedUsersCount = candidateUsers.filter((u) => {
    const resp = responseByUserId.get(u.id);
    return resp && resp.submittedVia !== "autosave";
  }).length;

  const isTimeEnded = now.getTime() > endTime.getTime();
  const allAssignedSubmitted =
    candidateUsers.length > 0 && submittedUsersCount >= candidateUsers.length;
  const isConcluded = isTimeEnded || allAssignedSubmitted;

  // Determine exam lifecycle status
  let examStatus: "upcoming" | "active" | "concluded" = "active";
  if (now.getTime() < startTime.getTime() - 60 * 1000) {
    examStatus = "upcoming";
  } else if (isConcluded) {
    examStatus = "concluded";
  }

  // Compile candidate rows
  const candidates = candidateUsers.map((u) => {
    const roll = (u.rollNumber || "").toUpperCase();
    const seat = seatingAssignments.find((s) => s.rollNumber.toUpperCase() === roll);
    const resp = responseByUserId.get(u.id);

    // Filter telemetry for this user
    const userFocus = focusLogs.filter((f) => f.userId === u.id);
    const userEditor = editorEvents.filter((e) => e.userId === u.id);
    const userProctor = proctorEvents.filter((p) => p.userId === u.id);

    const isSubmitted = resp && resp.submittedVia !== "autosave";
    const hasAutosave = resp && resp.submittedVia === "autosave";

    // Recent activity timestamp
    let lastActiveAt: Date | null = null;
    if (resp?.submittedAt) lastActiveAt = new Date(resp.submittedAt);
    if (userFocus.length > 0 && (!lastActiveAt || new Date(userFocus[0].timestamp) > lastActiveAt)) {
      lastActiveAt = new Date(userFocus[0].timestamp);
    }
    if (userEditor.length > 0 && (!lastActiveAt || new Date(userEditor[0].timestamp) > lastActiveAt)) {
      lastActiveAt = new Date(userEditor[0].timestamp);
    }

    // Determine candidate active/idle/submitted/not_started status
    let status: "not_started" | "answering" | "idle" | "submitted" = "not_started";
    if (isSubmitted) {
      status = "submitted";
    } else if (hasAutosave || lastActiveAt) {
      const msSinceActive = lastActiveAt ? now.getTime() - lastActiveAt.getTime() : Infinity;
      status = msSinceActive < 120000 ? "answering" : "idle";
    }

    // Answered progress count
    const answersObj = (resp?.answers as Record<string, any>) || {};
    const answeredKeys = Object.keys(answersObj).filter(
      (k) => !k.startsWith("__") && answersObj[k] && String(answersObj[k]).trim().length > 0
    );
    const answeredCount = answeredKeys.length;

    // Monaco editor telemetry totals
    let totalKeystrokes = 0;
    let totalPastes = 0;
    let totalBlurs = 0;

    const telemetryMeta = answersObj.__telemetry || {};
    for (const qId of Object.keys(telemetryMeta)) {
      const qTel = telemetryMeta[qId];
      if (qTel) {
        totalKeystrokes += qTel.keystrokes || 0;
        totalPastes += qTel.pastes || 0;
        totalBlurs += qTel.blurs || 0;
      }
    }

    // Add count of editor events
    totalPastes += userEditor.filter((e) => e.eventType === "paste").length;
    totalBlurs += userFocus.filter((f) => f.eventType === "blur").length;

    // Calculate completion time in seconds
    let completionTimeSec: number | null = null;
    if (isSubmitted && resp?.submittedAt) {
      const respAny = resp as any;
      const started = respAny.startedAt ? new Date(respAny.startedAt).getTime() : startTime.getTime();
      const submitted = new Date(resp.submittedAt).getTime();
      completionTimeSec = Math.max(1, Math.round((submitted - started) / 1000));
    }

    // REQUIREMENT 7: During Active Test Window, Candidate scores MUST be hidden.
    // Once test has ended, dashboard reveals scores.
    const respAny = resp as any;
    const score = isConcluded ? (respAny?.score ?? null) : null;
    const maxScore = isConcluded ? (respAny?.maxScore ?? null) : null;

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      rollNumber: u.rollNumber,
      seatRow: seat ? seat.seatRow + 1 : null,
      seatCol: seat ? seat.seatCol + 1 : null,
      questionSetId: seat?.questionSetId || "SET-A",
      status,
      answeredCount,
      totalQuestions: questions.length,
      lastActiveAt: lastActiveAt ? lastActiveAt.toISOString() : null,
      submittedAt: resp?.submittedAt ? resp.submittedAt.toISOString() : null,
      completionTimeSec,
      score,
      maxScore,
      telemetryStats: {
        totalKeystrokes,
        totalPastes,
        totalBlurs,
        anomaliesCount: userFocus.length + userProctor.filter((p) => p.flagged).length,
      },
    };
  });

  // Real Alerts feed from FocusLog and ProctoringEvent
  const alerts = [
    ...focusLogs.map((f) => {
      let desc = "Window/Tab focus lost";
      let severity: "warning" | "critical" | "info" = "warning";
      if (f.eventType.includes("fullscreen_exit")) {
        desc = "Candidate exited fullscreen security lock";
        severity = "critical";
      } else if (f.eventType.includes("visibility_hidden")) {
        desc = "Candidate switched browser tab or minimized window";
        severity = "critical";
      } else if (f.eventType.includes("blur")) {
        desc = "Candidate clicked outside exam window";
        severity = "warning";
      }
      return {
        id: f.id,
        userId: f.userId,
        userName: f.user?.name || "Candidate",
        rollNumber: f.user?.rollNumber || "Unknown",
        type: desc,
        rawEvent: f.eventType,
        severity,
        flagged: true,
        cheatProbability: severity === "critical" ? 0.85 : 0.6,
        timestamp: f.timestamp.toISOString(),
      };
    }),
    ...proctorEvents.map((p) => {
      let desc = "AI Proctor: Anomaly detected";
      if (p.detailsEncrypted) {
        try {
          const dec = decrypt(p.detailsEncrypted);
          if (dec) desc = `AI Proctor: ${dec}`;
        } catch {
          desc = `AI Proctor: ${p.detailsEncrypted}`;
        }
      }
      return {
        id: p.id,
        userId: p.userId,
        userName: p.user?.name || "Candidate",
        rollNumber: p.user?.rollNumber || "Unknown",
        type: desc,
        rawEvent: "proctor_event",
        severity: p.cheatProbability > 0.8 ? ("critical" as const) : ("warning" as const),
        flagged: p.flagged,
        cheatProbability: p.cheatProbability,
        timestamp: p.createdAt.toISOString(),
      };
    }),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Metrics
  const activeCandidatesCount = candidates.filter((c) => c.status === "answering").length;
  const submittedCount = candidates.filter((c) => c.status === "submitted").length;
  const totalFlaggedAnomalies = alerts.filter((a) => a.flagged).length;

  return {
    exam: {
      id: exam.id,
      testId: exam.testId || exam.id,
      title: exam.title,
      description: exam.description,
      location: exam.location,
      duration: exam.duration,
      startTime: exam.startTime.toISOString(),
      endTime: exam.endTime.toISOString(),
      status: examStatus,
      isConcluded,
      totalQuestions: questions.length,
    },
    metrics: {
      totalAssignedCandidates: candidates.length,
      activeCandidatesCount,
      submittedCount,
      totalFlaggedAnomalies,
    },
    candidates,
    alerts,
  };
}

// Live Candidate Response Sheet Viewer (Requirement 5 & 8)
export async function getCandidateAnswerSheet(examIdentifier: string, targetUserId: string) {
  const exam = await ensureExamExists(examIdentifier, "admin");

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, rollNumber: true },
  });

  if (!user) {
    throw new NotFoundError("Candidate user not found", "USER_NOT_FOUND");
  }

  const [questions, response, seatingAssignment, editorEvents, focusLogs] =
    await Promise.all([
      prisma.question.findMany({
        where: { examId: exam.id },
        orderBy: { order: "asc" },
      }),
      prisma.examResponse.findFirst({
        where: { examId: exam.id, userId: targetUserId },
      }),
      prisma.seatingAssignment.findFirst({
        where: { examId: exam.id, rollNumber: user.rollNumber || "" },
      }),
      prisma.editorTelemetryEvent.findMany({
        where: { examId: exam.id, userId: targetUserId },
        orderBy: { timestamp: "desc" },
        take: 50,
      }),
      prisma.focusLog.findMany({
        where: { examId: exam.id, userId: targetUserId },
        orderBy: { timestamp: "desc" },
        take: 50,
      }),
    ]);

  const now = new Date();
  const isTimeEnded = now.getTime() > new Date(exam.endTime).getTime();
  const isSubmitted = response && response.submittedVia !== "autosave";
  const isConcluded = isTimeEnded || Boolean(isSubmitted);

  const answersObj = (response?.answers as Record<string, any>) || {};
  const telemetryObj = answersObj.__telemetry || {};

  // If already evaluated or evaluate now
  const evaluation = evaluateResponses(questions, answersObj);

  const questionSheets = questions.map((q) => {
    const meta = (q.metadata as Record<string, any>) || {};
    const evalData = evaluation.breakdown[q.id];
    const candidateAnswer = answersObj[q.id] || null;
    const qTelemetry = telemetryObj[q.id] || {};

    return {
      id: q.id,
      type: q.type,
      content: q.content,
      order: q.order,
      options: meta.options || null,
      language: meta.language || qTelemetry.language || "python",
      starterCode: meta.starterCode || null,
      solutionCode: isConcluded ? (meta.solutionCode || meta.sampleAnswer || null) : null,
      correctAnswer: isConcluded ? (meta.correctAnswer || meta.correctAnswers || null) : null,
      candidateAnswer,
      pointsPossible: evalData?.pointsPossible || Number(meta.points ?? 1),
      pointsAwarded: isConcluded ? evalData?.pointsAwarded : null,
      status: isConcluded ? evalData?.status : "pending",
      telemetry: {
        keystrokes: qTelemetry.keystrokes || 0,
        pastes: qTelemetry.pastes || 0,
        blurs: qTelemetry.blurs || 0,
        language: qTelemetry.language || meta.language || "python",
      },
    };
  });

  return {
    candidate: {
      id: user.id,
      name: user.name,
      email: user.email,
      rollNumber: user.rollNumber,
      seatRow: seatingAssignment ? seatingAssignment.seatRow + 1 : null,
      seatCol: seatingAssignment ? seatingAssignment.seatCol + 1 : null,
      questionSetId: seatingAssignment?.questionSetId || "SET-A",
    },
    exam: {
      id: exam.id,
      testId: exam.testId || exam.id,
      title: exam.title,
      isConcluded,
    },
    responseInfo: {
      submitted: Boolean(isSubmitted),
      submittedVia: response?.submittedVia || null,
      startedAt: (response as any)?.startedAt ? (response as any).startedAt.toISOString() : null,
      submittedAt: response?.submittedAt ? response.submittedAt.toISOString() : null,
      score: isConcluded ? evaluation.totalScore : null,
      maxScore: evaluation.maxScore,
    },
    questions: questionSheets,
    recentEditorEvents: editorEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      payload: e.payload,
      timestamp: e.timestamp.toISOString(),
    })),
    recentFocusEvents: focusLogs.map((f) => ({
      id: f.id,
      eventType: f.eventType,
      timestamp: f.timestamp.toISOString(),
    })),
  };
}
