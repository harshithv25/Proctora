import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../config/db";

async function flushLogs() {
  console.log("==================================================================");
  console.log("                 PROCTORA AUDIT LOGS FLUSH SCRIPT                 ");
  console.log("==================================================================");

  // Check if days retention was specified: e.g. tsx src/scripts/flushLogs.ts 30
  const retentionDaysArg = process.argv[2];
  let deleteFilter = {};
  let modeDescription = "Wiping ALL audit logs from the database...";

  if (retentionDaysArg && !isNaN(Number(retentionDaysArg))) {
    const cutoff = new Date(Date.now() - Number(retentionDaysArg) * 24 * 60 * 60 * 1000);
    deleteFilter = { timestamp: { lt: cutoff } };
    modeDescription = `Flushing logs older than ${retentionDaysArg} days (prior to ${cutoff.toISOString()})...`;
  }

  console.log(modeDescription);

  const initialCount = await prisma.log.count({});
  console.log(`Current total audit logs in table: ${initialCount.toLocaleString()}`);

  const del = await prisma.log.deleteMany({ where: deleteFilter });
  console.log(`✔ Successfully removed ${del.count.toLocaleString()} audit log(s).`);

  const remaining = await prisma.log.count({});
  console.log(`Remaining audit logs: ${remaining.toLocaleString()}`);
  console.log("==================================================================");

  await prisma.$disconnect();
}

flushLogs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Flush logs failed:", err);
    process.exit(1);
  });
