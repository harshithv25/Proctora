import { prisma } from "../../config/db";
import { NotFoundError, ConflictError } from "../../lib/apiError";

function generateTestId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TEST-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Pseudo-random deterministic permutation for a given set index
function getShuffledQuestionIds(questionIds: string[], setIndex: number): string[] {
  if (questionIds.length <= 1) return [...questionIds];
  const list = [...questionIds];
  // Simple LCG PRNG seeded by setIndex
  let seed = (setIndex + 1) * 2654435761;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Fisher-Yates shuffle
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  // Ensure set 0 is not necessarily untouched if there are > 1 questions
  return list;
}

export async function listExams() {
  const exams = await prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          questions: true,
          seatingPlan: true,
          responses: true,
        },
      },
    },
  });

  return exams.map((exam) => ({
    id: exam.id,
    testId: exam.testId || exam.id,
    title: exam.title,
    description: exam.description,
    location: exam.location,
    maxStudents: exam.maxStudents,
    duration: exam.duration,
    startTime: exam.startTime,
    endTime: exam.endTime,
    idleTimeoutSec: exam.idleTimeoutSec,
    createdAt: exam.createdAt,
    questionCount: exam._count.questions,
    candidateCount: exam._count.seatingPlan,
    responseCount: exam._count.responses,
  }));
}

export async function getExamByIdOrTestId(identifier: string) {
  const exam = await prisma.exam.findFirst({
    where: {
      OR: [{ id: identifier }, { testId: identifier }],
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      seatingPlan: {
        orderBy: [{ seatRow: "asc" }, { seatCol: "asc" }],
      },
      accommodations: true,
      _count: {
        select: {
          responses: true,
        },
      },
    },
  });

  if (!exam) {
    throw new NotFoundError("Examination not found", "EXAM_NOT_FOUND");
  }

  return {
    ...exam,
    testId: exam.testId || exam.id,
    responseCount: exam._count.responses,
  };
}

export async function createExam(data: {
  title: string;
  testId?: string;
  description?: string;
  location?: string;
  maxStudents?: number;
  duration?: number;
  startTime?: string;
  endTime?: string;
  idleTimeoutSec?: number;
  createdBy: string;
}) {
  let testId = data.testId?.trim().toUpperCase();
  if (!testId) {
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateTestId();
      const existing = await prisma.exam.findFirst({ where: { testId: candidate } });
      if (!existing) {
        testId = candidate;
        break;
      }
      attempts++;
    }
    if (!testId) testId = generateTestId();
  } else {
    const existing = await prisma.exam.findFirst({ where: { testId } });
    if (existing) {
      throw new ConflictError("An exam with this Test ID already exists. Please choose a different Test ID.", "TEST_ID_EXISTS");
    }
  }

  const durationMinutes = data.duration ?? 60;
  const start = data.startTime ? new Date(data.startTime) : new Date();
  const end = data.endTime
    ? new Date(data.endTime)
    : new Date(start.getTime() + durationMinutes * 60 * 1000);

  return prisma.exam.create({
    data: {
      title: data.title.trim(),
      testId,
      description: data.description?.trim(),
      location: data.location?.trim(),
      maxStudents: data.maxStudents,
      duration: durationMinutes,
      startTime: start,
      endTime: end,
      idleTimeoutSec: data.idleTimeoutSec ?? 300,
      createdBy: data.createdBy,
    },
  });
}

export async function updateExam(
  examId: string,
  data: {
    title?: string;
    testId?: string;
    description?: string;
    location?: string;
    maxStudents?: number;
    duration?: number;
    startTime?: string;
    endTime?: string;
    idleTimeoutSec?: number;
  }
) {
  const existing = await prisma.exam.findUnique({ where: { id: examId } });
  if (!existing) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }

  if (data.testId && data.testId.trim().toUpperCase() !== existing.testId) {
    const duplicate = await prisma.exam.findFirst({
      where: { testId: data.testId.trim().toUpperCase(), NOT: { id: examId } },
    });
    if (duplicate) {
      throw new ConflictError("Test ID is already taken by another exam.", "TEST_ID_EXISTS");
    }
  }

  const duration = data.duration ?? existing.duration;
  let startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
  let endTime = data.endTime
    ? new Date(data.endTime)
    : new Date(startTime.getTime() + duration * 60 * 1000);

  return prisma.exam.update({
    where: { id: examId },
    data: {
      ...(data.title ? { title: data.title.trim() } : {}),
      ...(data.testId ? { testId: data.testId.trim().toUpperCase() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() } : {}),
      ...(data.location !== undefined ? { location: data.location?.trim() } : {}),
      ...(data.maxStudents !== undefined ? { maxStudents: data.maxStudents } : {}),
      duration,
      startTime,
      endTime,
      ...(data.idleTimeoutSec ? { idleTimeoutSec: data.idleTimeoutSec } : {}),
    },
  });
}

export async function saveQuestions(
  examId: string,
  questions: {
    id?: string;
    content: string;
    type: "descriptive" | "coding" | "mcq" | "multi_correct";
    order?: number;
    metadata?: Record<string, unknown>;
  }[]
) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { seatingPlan: true },
  });
  if (!exam) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }

  // Delete existing questions and re-insert to preserve ordering cleanly
  await prisma.question.deleteMany({ where: { examId } });

  const createdQuestions = await Promise.all(
    questions.map((q, idx) =>
      prisma.question.create({
        data: {
          examId,
          content: q.content.trim(),
          type: q.type,
          order: q.order ?? idx,
          metadata: q.metadata ? (q.metadata as any) : undefined,
        },
      })
    )
  );

  // If there are existing seating assignments, re-generate neighbor-shuffled question order
  if (exam.seatingPlan.length > 0 && createdQuestions.length > 0) {
    const questionIds = createdQuestions.map((q) => q.id);
    for (const seat of exam.seatingPlan) {
      // 9-color tiling so all 8 neighbours (orthogonal & diagonal) have distinct sets
      const setIdx = ((seat.seatRow % 3) * 3 + (seat.seatCol % 3)) % 9;
      const shuffled = getShuffledQuestionIds(questionIds, setIdx);
      const setId = `SET-${String.fromCharCode(65 + setIdx)}`;

      await prisma.seatingAssignment.update({
        where: { id: seat.id },
        data: {
          questionSetId: setId,
          questionOrder: shuffled,
        },
      });
    }
  }

  return createdQuestions;
}

export async function processSeatingCsv(
  examId: string,
  csvContent: string,
  hasHeader = false
) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!exam) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }

  // Parse CSV lines and cells
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Seating CSV is empty");
  }

  const rawGrid = lines.map((line) =>
    line.split(",").map((cell) => cell.trim())
  );

  let grid = rawGrid;
  if (hasHeader && grid.length > 1) {
    grid = grid.slice(1);
  }

  const questionIds = exam.questions.map((q) => q.id);
  const assignments: {
    rollNumber: string;
    seatRow: number;
    seatCol: number;
    questionSetId: string;
    questionOrder: string[];
  }[] = [];

  const seenRollNumbers = new Set<string>();

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const rollNumber = grid[r][c];
      if (!rollNumber || rollNumber === "-" || rollNumber === "EMPTY") {
        continue;
      }

      // Check duplicate roll numbers in seating plan
      const normalizedRoll = rollNumber.toUpperCase();
      if (seenRollNumbers.has(normalizedRoll)) {
        throw new ConflictError(
          `Duplicate roll number "${rollNumber}" found in seating plan at Row ${r + 1}, Col ${c + 1}.`,
          "DUPLICATE_SEATING_ENTRY"
        );
      }
      seenRollNumbers.add(normalizedRoll);

      // Requirement 1.6:
      // First column is physical classroom column 1, etc.
      // Neighbor shuffle: 9-set pattern ensures all 8 surrounding desks (orthogonal + diagonal) get distinct sets!
      const setIdx = ((r % 3) * 3 + (c % 3)) % 9;
      const questionOrder = getShuffledQuestionIds(questionIds, setIdx);
      const questionSetId = `SET-${String.fromCharCode(65 + setIdx)}`;

      assignments.push({
        rollNumber: normalizedRoll,
        seatRow: r,
        seatCol: c,
        questionSetId,
        questionOrder,
      });
    }
  }

  // Save to database
  await prisma.seatingAssignment.deleteMany({ where: { examId } });

  if (assignments.length > 0) {
    await prisma.seatingAssignment.createMany({
      data: assignments.map((a) => ({
        examId,
        rollNumber: a.rollNumber,
        seatRow: a.seatRow,
        seatCol: a.seatCol,
        questionSetId: a.questionSetId,
        questionOrder: a.questionOrder,
      })),
    });
  }

  // Update exam record with seatingCsv, seatingGrid, and maxStudents if not set
  await prisma.exam.update({
    where: { id: examId },
    data: {
      seatingCsv: csvContent,
      seatingGrid: grid as any,
      maxStudents: assignments.length,
    },
  });

  return {
    totalStudents: assignments.length,
    rows: grid.length,
    cols: Math.max(...grid.map((row) => row.length), 0),
    grid,
    assignments,
  };
}

export async function grantAccommodation(
  examId: string,
  userId: string,
  extraTimeSec: number,
  approvedBy: string
) {
  return prisma.accommodation.create({
    data: { examId, userId, extraTimeSec, approvedBy },
  });
}

export async function deleteExam(examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    throw new NotFoundError("Exam not found", "EXAM_NOT_FOUND");
  }
  return prisma.exam.delete({ where: { id: examId } });
}
