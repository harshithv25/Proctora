import { prisma } from "../../config/db";
import { AppError, NotFoundError } from "../../lib/apiError";

async function ensureExamExists(examId: string, userId: string) {
  const existing = await prisma.exam.findUnique({ where: { id: examId } });
  if (existing) return existing;

  if (examId === "demo-exam-1") {
    return prisma.exam.create({
      data: {
        id: "demo-exam-1",
        title: "Midterm Examination: Algorithms & Data Structures",
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        idleTimeoutSec: 300,
        createdBy: userId,
      },
    });
  }

  throw new NotFoundError(
    `Exam with ID '${examId}' does not exist. Please create the exam first.`,
    "EXAM_NOT_FOUND"
  );
}

export async function autosave(
  examId: string,
  userId: string,
  answers: unknown
) {
  await ensureExamExists(examId, userId);

  const existing = await prisma.examResponse.findFirst({
    where: { examId, userId },
  });

  if (existing) {
    return prisma.examResponse.update({
      where: { id: existing.id },
      data: { answers: answers as any, submittedVia: "autosave" },
    });
  }

  return prisma.examResponse.create({
    data: {
      examId,
      userId,
      answers: answers as any,
      submittedVia: "autosave",
    },
  });
}

export async function submit(
  examId: string,
  userId: string,
  answers: unknown,
  submittedVia: string
) {
  await ensureExamExists(examId, userId);

  const existing = await prisma.examResponse.findFirst({
    where: { examId, userId },
  });

  if (existing) {
    return prisma.examResponse.update({
      where: { id: existing.id },
      data: {
        answers: answers as any,
        submittedVia,
        submittedAt: new Date(),
      },
    });
  }

  return prisma.examResponse.create({
    data: {
      examId,
      userId,
      answers: answers as any,
      submittedVia,
    },
  });
}

export async function exportResponses(examId: string) {
  return prisma.examResponse.findMany({
    where: { examId },
    include: {
      user: {
        select: { id: true, name: true, email: true, rollNumber: true },
      },
    },
    orderBy: { submittedAt: "asc" },
  });
}
