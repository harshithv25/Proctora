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
    update: {
      testId: "DEMO-CS101",
      duration: 90,
      description: "Comprehensive assessment covering data structures, algorithmic complexity, graph traversal, and coding implementation.",
      location: "Auditorium Hall 3B",
      maxStudents: 60,
    },
    create: {
      id: "demo-exam-1",
      testId: "DEMO-CS101",
      title: "Midterm Examination: Algorithms & Data Structures",
      description: "Comprehensive assessment covering data structures, algorithmic complexity, graph traversal, and coding implementation.",
      location: "Auditorium Hall 3B",
      maxStudents: 60,
      duration: 90,
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      idleTimeoutSec: 300,
      createdBy: admin.id,
      seatingCsv: "21CS001,21CS002,21CS003\n21CS004,21CS005,21CS006",
      seatingGrid: [
        ["21CS001", "21CS002", "21CS003"],
        ["21CS004", "21CS005", "21CS006"]
      ],
    },
  });
  console.log("✅ Demo Exam created:", exam.id, "Test ID:", exam.testId);

  // 4. Create Sample Questions
  const questionsCount = await prisma.question.count({ where: { examId: exam.id } });
  if (questionsCount === 0) {
    await prisma.question.createMany({
      data: [
        {
          examId: exam.id,
          content: "Which of the following data structures offer amortized O(1) average time complexity for key-value insertions and lookups?",
          type: "mcq",
          order: 0,
          metadata: {
            options: ["Binary Search Tree", "Hash Map", "Red-Black Tree", "Skip List"],
            correctAnswer: "Hash Map",
          },
        },
        {
          examId: exam.id,
          content: "Implement an in-place function in Python to reverse a singly-linked list given its head node. Ensure your solution uses O(1) auxiliary space.",
          type: "coding",
          order: 1,
          metadata: {
            language: "python",
            starterCode: "class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef reverse_list(head: ListNode) -> ListNode:\n    # Write your solution here\n    pass\n",
            solutionCode: "def reverse_list(head):\n    prev, curr = None, head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev\n",
          },
        },
        {
          examId: exam.id,
          content: "Select ALL sorting algorithms that operate with worst-case O(n log n) runtime complexity.",
          type: "multi_correct",
          order: 2,
          metadata: {
            options: ["Merge Sort", "Quick Sort", "Heap Sort", "Bubble Sort"],
            correctAnswers: ["Merge Sort", "Heap Sort"],
          },
        },
        {
          examId: exam.id,
          content: "Explain the Byzantine Generals Problem in distributed computing and describe how consensus is reached in a fault-tolerant network.",
          type: "descriptive",
          order: 3,
          metadata: {
            sampleAnswer: "The Byzantine Generals Problem illustrates the challenge of reaching consensus among distributed nodes when some communication channels or nodes may fail or act maliciously. Consensus requires agreement despite up to (n-1)/3 faulty nodes in standard asynchronous Byzantine fault tolerance.",
            rubric: "Mention consensus challenge (2 pts), malicious/faulty actors (2 pts), tolerance threshold or protocol mechanism (2 pts).",
          },
        },
      ],
    });
    console.log("✅ Sample questions seeded (MCQ, Coding, Multi-Correct, Descriptive)");
  }

  // 5. Seating assignment
  await prisma.seatingAssignment.createMany({
    data: [
      {
        examId: exam.id,
        rollNumber: "21CS001",
        seatRow: 0,
        seatCol: 0,
        questionSetId: "SET-A",
      },
      {
        examId: exam.id,
        rollNumber: "21CS002",
        seatRow: 0,
        seatCol: 1,
        questionSetId: "SET-B",
      },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Seating plan seeded");

  console.log("✨ Seeding completed successfully!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
