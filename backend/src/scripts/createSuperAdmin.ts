import dotenv from "dotenv";
dotenv.config();
import argon2 from "argon2";
import { prisma } from "../config/db";
import { logEvent } from "../lib/eventLogger";

async function createSuperAdmin() {
  console.log("==================================================================");
  console.log("             PROCTORA SUPER ADMINISTRATOR PROVISIONING            ");
  console.log("==================================================================");

  const email = (process.env.SUPERADMIN_EMAIL || process.argv[2] || "superadmin@proctora.edu").trim().toLowerCase();
  const rawPassword = process.env.SUPERADMIN_PASSWORD || process.argv[3] || "SuperAdmin@12345";
  const name = process.env.SUPERADMIN_NAME || process.argv[4] || "Root Super Administrator";

  console.log(`Provisioning Super Admin:`);
  console.log(`  * Email: ${email}`);
  console.log(`  * Name:  ${name}`);
  console.log(`  * Role:  SUPER_ADMIN`);

  const passwordHash = await argon2.hash(rawPassword);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "SUPER_ADMIN",
      passwordHash,
      isLocked: false,
      failedLoginAttempts: 0,
    },
    create: {
      name,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      isLocked: false,
      failedLoginAttempts: 0,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  await logEvent({
    eventType: "admin_create",
    userId: user.id,
    username: user.name,
    userEmail: user.email,
    details: { role: "SUPER_ADMIN", provisionedVia: "cli_script" },
  });

  console.log(`\n✔ Super Administrator provisioned successfully!`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Role: ${user.role}`);
  console.log(`\nYou can now log in at /login with these credentials.`);
  console.log(`The Super Admin Audit Dashboard is available at /super-admin.`);
  console.log("==================================================================");

  await prisma.$disconnect();
}

createSuperAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Super Admin provisioning failed:", err);
    process.exit(1);
  });
