import { prisma } from "../../config/db";

export async function autosave(
  examId: string,
  userId: string,
  answers: unknown
) {
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
