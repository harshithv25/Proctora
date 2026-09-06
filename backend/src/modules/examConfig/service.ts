import { prisma } from "../../config/db";

export async function createExam(data: {
  title: string;
  startTime: string;
  endTime: string;
  idleTimeoutSec: number;
  createdBy: string;
}) {
  return prisma.exam.create({
    data: {
      title: data.title,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      idleTimeoutSec: data.idleTimeoutSec,
      createdBy: data.createdBy,
    },
  });
}

export async function addQuestions(
  examId: string,
  questions: { content: string; type: string; metadata?: unknown }[]
) {
  return prisma.question.createMany({
    data: questions.map((q) => ({
      examId,
      content: q.content,
      type: q.type,
      metadata: q.metadata ?? undefined,
    })),
  });
}

export async function setSeatingPlan(
  examId: string,
  assignments: {
    rollNumber: string;
    seatRow: number;
    seatCol: number;
    questionSetId?: string;
  }[]
) {
  await prisma.seatingAssignment.deleteMany({ where: { examId } });
  return prisma.seatingAssignment.createMany({
    data: assignments.map((a) => ({ examId, ...a })),
  });
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
