import { prisma } from "../config/db";
import { NotFoundError } from "./apiError";

export async function findExamByIdOrTestId(identifier: string) {
  const exam = await prisma.exam.findFirst({
    where: {
      OR: [{ id: identifier }, { testId: identifier }],
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      seatingPlan: true,
      responses: true,
    },
  });

  if (!exam) {
    throw new NotFoundError(
      `Examination '${identifier}' not found.`,
      "EXAM_NOT_FOUND"
    );
  }

  return exam;
}
