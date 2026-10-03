import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../config/db";

async function flushNonAdminUsers() {
  console.log("Starting user flush: preserving all ADMIN accounts...");

  // 1. Fetch non-admin user IDs
  const nonAdminUsers = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
    },
    select: { id: true, email: true, rollNumber: true, role: true },
  });

  const ids = nonAdminUsers.map((u) => u.id);
  console.log(`Found ${ids.length} non-admin user(s) to remove:`);
  for (const u of nonAdminUsers) {
    console.log(`  - [${u.role}] ${u.email} (Roll: ${u.rollNumber || "N/A"})`);
  }

  if (ids.length === 0) {
    console.log("No non-admin users found. Database is already clean.");
    await prisma.$disconnect();
    return;
  }

  // 2. Cascade delete all dependent relational tables
  const delTelemetry = await prisma.editorTelemetryEvent.deleteMany({
    where: { userId: { in: ids } },
  });
  console.log(`Removed ${delTelemetry.count} editor telemetry events.`);

  const delFocus = await prisma.focusLog.deleteMany({
    where: { userId: { in: ids } },
  });
  console.log(`Removed ${delFocus.count} focus logs.`);

  const delProctoring = await prisma.proctoringEvent.deleteMany({
    where: { userId: { in: ids } },
  });
  console.log(`Removed ${delProctoring.count} proctoring invigilation events.`);

  const delAccommodations = await prisma.accommodation.deleteMany({
    where: { userId: { in: ids } },
  });
  console.log(`Removed ${delAccommodations.count} accommodations.`);

  const delResponses = await prisma.examResponse.deleteMany({
    where: { userId: { in: ids } },
  });
  console.log(`Removed ${delResponses.count} exam responses.`);

  const delSessions = await prisma.session.deleteMany({
    where: { userId: { in: ids } },
  });
  console.log(`Removed ${delSessions.count} active sessions.`);

  // 3. Remove non-admin user accounts
  const delUsers = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`Successfully flushed ${delUsers.count} non-admin user accounts.`);

  // Verify remaining users
  const remainingAdmins = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
  });
  console.log(`Remaining accounts (${remainingAdmins.length}):`);
  for (const a of remainingAdmins) {
    console.log(`  * [${a.role}] ${a.email}`);
  }

  await prisma.$disconnect();
}

flushNonAdminUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Flush operation failed:", err);
    process.exit(1);
  });
