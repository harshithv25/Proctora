import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../config/db";

async function flushExams() {
  console.log("Starting examination flush: clearing all tests, questions, and test data...");

  // 1. Fetch current exams
  const exams = await prisma.exam.findMany({
    select: { id: true, testId: true, title: true },
  });

  console.log(`Found ${exams.length} examination(s) to remove:`);
  for (const e of exams) {
    console.log(`  - [${e.testId || e.id}] ${e.title}`);
  }

  if (exams.length === 0) {
    console.log("No examinations found. Registry is already empty.");
    await prisma.$disconnect();
    return;
  }

  // 2. Cascade delete telemetry & examination dependent data
  const delTelemetry = await prisma.editorTelemetryEvent.deleteMany({});
  console.log(`Removed ${delTelemetry.count} editor telemetry events.`);

  const delFocus = await prisma.focusLog.deleteMany({});
  console.log(`Removed ${delFocus.count} focus logs.`);

  const delProctoring = await prisma.proctoringEvent.deleteMany({});
  console.log(`Removed ${delProctoring.count} proctoring invigilation events.`);

  const delAccommodations = await prisma.accommodation.deleteMany({});
  console.log(`Removed ${delAccommodations.count} accommodations.`);

  const delResponses = await prisma.examResponse.deleteMany({});
  console.log(`Removed ${delResponses.count} exam responses.`);

  const delSeating = await prisma.seatingAssignment.deleteMany({});
  console.log(`Removed ${delSeating.count} seating plan desk assignments.`);

  const delQuestions = await prisma.question.deleteMany({});
  console.log(`Removed ${delQuestions.count} questions.`);

  const delExams = await prisma.exam.deleteMany({});
  console.log(`Successfully removed ${delExams.count} examinations.`);

  console.log("Examination registry is now clean.");
  await prisma.$disconnect();
}

flushExams()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Flush examinations failed:", err);
    process.exit(1);
  });
