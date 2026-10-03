import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../config/db";

async function resetDatabaseExceptAdmin() {
  console.log("==================================================================");
  console.log("Starting Full Database Reset (Preserving Administrator Credentials)");
  console.log("==================================================================");

  // 1. Identify non-admin accounts
  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, email: true, rollNumber: true, role: true },
  });

  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, name: true },
  });

  console.log(`Preserving ${adminUsers.length} Administrator account(s):`);
  for (const a of adminUsers) {
    console.log(`  * [ADMIN] ${a.email} (${a.name})`);
  }

  console.log(`\nFlushing ${nonAdminUsers.length} candidate user(s) and all test data...`);

  // 2. Cascade delete all operational & telemetry logs
  const delTelemetry = await prisma.editorTelemetryEvent.deleteMany({});
  console.log(`- Removed ${delTelemetry.count} Monaco editor telemetry events.`);

  const delFocus = await prisma.focusLog.deleteMany({});
  console.log(`- Removed ${delFocus.count} window/tab focus blur events.`);

  const delProctoring = await prisma.proctoringEvent.deleteMany({});
  console.log(`- Removed ${delProctoring.count} proctoring anomaly events.`);

  const delAccommodations = await prisma.accommodation.deleteMany({});
  console.log(`- Removed ${delAccommodations.count} student accommodations.`);

  const delResponses = await prisma.examResponse.deleteMany({});
  console.log(`- Removed ${delResponses.count} submitted exam responses.`);

  const delSeating = await prisma.seatingAssignment.deleteMany({});
  console.log(`- Removed ${delSeating.count} seating plan desk assignments.`);

  const delQuestions = await prisma.question.deleteMany({});
  console.log(`- Removed ${delQuestions.count} questions.`);

  const delExams = await prisma.exam.deleteMany({});
  console.log(`- Removed ${delExams.count} examinations.`);

  const delSessions = await prisma.session.deleteMany({});
  console.log(`- Removed ${delSessions.count} user login sessions.`);

  const delUsers = await prisma.user.deleteMany({
    where: { role: { not: "ADMIN" } },
  });
  console.log(`- Removed ${delUsers.count} non-admin user accounts.`);

  // 3. Reset admin security lockouts and failed attempts
  await prisma.user.updateMany({
    where: { role: "ADMIN" },
    data: {
      isLocked: false,
      failedLoginAttempts: 0,
    },
  });
  console.log(`- Reset lockout states and failed attempts for all administrators.`);

  console.log("\n==================================================================");
  console.log("Database reset complete. All test data & candidate users cleared.");
  console.log("Administrators can now log in and configure fresh tests.");
  console.log("==================================================================");

  await prisma.$disconnect();
}

resetDatabaseExceptAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Database reset failed:", err);
    process.exit(1);
  });
