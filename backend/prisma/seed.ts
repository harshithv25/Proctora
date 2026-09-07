import dotenv from "dotenv";
dotenv.config();

import argon2 from "argon2";
import { prisma } from "../src/config/db";

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create Admin
  const adminPasswordHash = await argon2.hash("Admin@12345");
  const admin = await prisma.user.upsert({
    where: { email: "admin@proctora.edu" },
    update: {},
    create: {
      name: "System Administrator",
      email: "admin@proctora.edu",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin created:", admin.email);

  // 2. Create Candidate
  const studentPasswordHash = await argon2.hash("Student@12345");
  const student = await prisma.user.upsert({
    where: { email: "student@proctora.edu" },
    update: {},
    create: {
      name: "Jane Doe",
      email: "student@proctora.edu",
      rollNumber: "21CS001",
      passwordHash: studentPasswordHash,
      role: "CANDIDATE",
    },
  });
  console.log("✅ Candidate created:", student.email);

  // 3. Create Demo Exam
  const exam = await prisma.exam.upsert({
    where: { id: "demo-exam-1" },
    update: {},
    create: {
      id: "demo-exam-1",
      title: "Midterm Examination: Algorithms & Data Structures",
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      idleTimeoutSec: 300,
      createdBy: admin.id,
    },
  });
  console.log("✅ Demo Exam created:", exam.id);

  // 4. Create Sample Questions
  const questionsCount = await prisma.question.count({ where: { examId: exam.id } });
  if (questionsCount === 0) {
    await prisma.question.createMany({
      data: [
        {
          examId: exam.id,
          content: "Which data structure offers amortized O(1) average time complexity for key-value insertions and lookups?",
          type: "mcq",
          metadata: { options: ["Binary Search Tree", "Hash Map", "Red-Black Tree", "Skip List"] },
        },
        {
          examId: exam.id,
          content: "Implement an in-place function in TypeScript/JavaScript to reverse a singly-linked list given its head pointer.",
          type: "code",
        },
        {
          examId: exam.id,
          content: "What is the worst-case time complexity of QuickSort when selecting the first element as the pivot in an already sorted array?",
          type: "mcq",
          metadata: { options: ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"] },
        },
      ],
    });
    console.log("✅ Sample questions seeded");
  }

  // 5. Seating assignment
  await prisma.seatingAssignment.createMany({
    data: [
      {
        examId: exam.id,
        rollNumber: "21CS001",
        seatRow: 1,
        seatCol: 1,
      },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Seating plan seeded");

  console.log("✨ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
