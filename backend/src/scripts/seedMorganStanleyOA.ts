import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { prisma } from "../config/db";

async function main() {
  console.log("Creating 'Morgan Stanley OA' examination...");

  const admin = await prisma.user.findUnique({
    where: { email: "admin@proctora.edu" },
  });

  if (!admin) {
    throw new Error("Admin user admin@proctora.edu not found!");
  }

  const testId = "TEST-MS2026";
  const now = Date.now();

  // Create or update exam
  const exam = await prisma.exam.upsert({
    where: { id: "morgan-stanley-oa-1" },
    update: {
      testId,
      title: "Morgan Stanley OA",
      description: "Technical Online Assessment for Morgan Stanley Software Engineering Campus Recruitment.",
      location: "Virtual Testing Lab Alpha",
      maxStudents: 100,
      duration: 90,
      startTime: new Date(now - 5 * 60 * 1000), // Active now (started 5 mins ago)
      endTime: new Date(now + 120 * 60 * 1000), // Concludes in 2 hours
      idleTimeoutSec: 300,
      createdBy: admin.id,
      seatingCsv: "21CS001,21CS002,21CS003\n21CS004,21CS005,21CS006",
      seatingGrid: [
        ["21CS001", "21CS002", "21CS003"],
        ["21CS004", "21CS005", "21CS006"],
      ],
    },
    create: {
      id: "morgan-stanley-oa-1",
      testId,
      title: "Morgan Stanley OA",
      description: "Technical Online Assessment for Morgan Stanley Software Engineering Campus Recruitment.",
      location: "Virtual Testing Lab Alpha",
      maxStudents: 100,
      duration: 90,
      startTime: new Date(now - 5 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000),
      idleTimeoutSec: 300,
      createdBy: admin.id,
      seatingCsv: "21CS001,21CS002,21CS003\n21CS004,21CS005,21CS006",
      seatingGrid: [
        ["21CS001", "21CS002", "21CS003"],
        ["21CS004", "21CS005", "21CS006"],
      ],
    },
  });

  console.log(`✅ Exam '${exam.title}' created with ID: ${exam.id}, Test ID: ${exam.testId}`);

  // Delete existing questions for this test to re-seed clean 10 questions
  await prisma.question.deleteMany({ where: { examId: exam.id } });

  const questionsData = [
    // 1. MCQ Single
    {
      examId: exam.id,
      content: "What is the worst-case search time complexity in a balanced Binary Search Tree (AVL / Red-Black Tree) containing N nodes?",
      type: "mcq",
      order: 0,
      metadata: {
        points: 1,
        options: ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
        correctAnswer: "O(log N)",
      },
    },
    // 2. MCQ Single
    {
      examId: exam.id,
      content: "Which HTTP status code indicates that the client request lacks valid authentication credentials for the target resource?",
      type: "mcq",
      order: 1,
      metadata: {
        points: 1,
        options: ["400 Bad Request", "401 Unauthorized", "403 Forbidden", "404 Not Found"],
        correctAnswer: "401 Unauthorized",
      },
    },
    // 3. MCQ Single
    {
      examId: exam.id,
      content: "In relational database ACID properties, which property ensures that concurrent execution of transactions leaves the database in the same state as if transactions were executed sequentially?",
      type: "mcq",
      order: 2,
      metadata: {
        points: 1,
        options: ["Atomicity", "Consistency", "Isolation", "Durability"],
        correctAnswer: "Isolation",
      },
    },
    // 4. Multi-Correct
    {
      examId: exam.id,
      content: "Select ALL algorithms that can be used to find the shortest path between nodes in a graph.",
      type: "multi_correct",
      order: 3,
      metadata: {
        points: 2,
        options: [
          "Dijkstra's Algorithm",
          "Bellman-Ford Algorithm",
          "Kruskal's Algorithm",
          "Floyd-Warshall Algorithm",
        ],
        correctAnswers: [
          "Dijkstra's Algorithm",
          "Bellman-Ford Algorithm",
          "Floyd-Warshall Algorithm",
        ],
      },
    },
    // 5. Multi-Correct
    {
      examId: exam.id,
      content: "Which of the following data structures can be effectively utilized to implement an efficient Priority Queue?",
      type: "multi_correct",
      order: 4,
      metadata: {
        points: 2,
        options: [
          "Binary Heap",
          "Fibonacci Heap",
          "Standard Queue (FIFO)",
          "Red-Black Tree",
        ],
        correctAnswers: [
          "Binary Heap",
          "Fibonacci Heap",
          "Red-Black Tree",
        ],
      },
    },
    // 6. Multi-Correct
    {
      examId: exam.id,
      content: "Select ALL correct characteristics of the TCP protocol when compared to UDP.",
      type: "multi_correct",
      order: 5,
      metadata: {
        points: 2,
        options: [
          "TCP is connection-oriented with 3-way handshake",
          "UDP provides automatic segment retransmission",
          "TCP provides flow control via sliding window",
          "UDP has minimal header overhead compared to TCP",
        ],
        correctAnswers: [
          "TCP is connection-oriented with 3-way handshake",
          "TCP provides flow control via sliding window",
          "UDP has minimal header overhead compared to TCP",
        ],
      },
    },
    // 7. Coding (Monaco)
    {
      examId: exam.id,
      content: "Write a function in Python `two_sum(nums: list[int], target: int) -> list[int]` that returns the 0-indexed positions of the two numbers that add up to target.",
      type: "coding",
      order: 6,
      metadata: {
        points: 5,
        language: "python",
        starterCode: "def two_sum(nums: list[int], target: int) -> list[int]:\n    # Implement your O(N) solution here\n    pass\n",
        solutionCode: "def two_sum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in lookup:\n            return [lookup[diff], i]\n        lookup[num] = i\n    return []\n",
      },
    },
    // 8. Coding (Monaco)
    {
      examId: exam.id,
      content: "Write a function in Python `is_valid_parentheses(s: str) -> bool` to determine if an input string containing '(', ')', '{', '}', '[' and ']' is balanced and properly nested.",
      type: "coding",
      order: 7,
      metadata: {
        points: 5,
        language: "python",
        starterCode: "def is_valid_parentheses(s: str) -> bool:\n    # Implement stack verification\n    pass\n",
        solutionCode: "def is_valid_parentheses(s: str) -> bool:\n    stack = []\n    pairs = {')': '(', '}': '{', ']': '['}\n    for ch in s:\n        if ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n        else:\n            stack.append(ch)\n    return len(stack) == 0\n",
      },
    },
    // 9. Descriptive
    {
      examId: exam.id,
      content: "Explain the difference between Optimistic Concurrency Control (OCC) and Pessimistic Locking in database transactions, highlighting their trade-offs under high write-contention workloads.",
      type: "descriptive",
      order: 8,
      metadata: {
        points: 3,
        rubric: "Explains locking vs validation (1 pt), conflict resolution (1 pt), performance trade-offs under contention (1 pt).",
        sampleAnswer: "Pessimistic locking prevents conflicts by locking data rows before modification, avoiding rollbacks at the cost of concurrency and deadlock risk. OCC allows concurrent reads and writes, verifying transaction validity at commit time, which excels under read-heavy workloads but incurs high retry costs under heavy write contention.",
      },
    },
    // 10. Descriptive
    {
      examId: exam.id,
      content: "Describe Python's dual memory management architecture: reference counting and the cyclic generational garbage collector.",
      type: "descriptive",
      order: 9,
      metadata: {
        points: 3,
        rubric: "Mention reference counting mechanism (1 pt), reference cycles problem (1 pt), generational GC stages 0/1/2 (1 pt).",
        sampleAnswer: "Python primarily manages memory through reference counting: when an object's reference counter drops to zero, its memory is deallocated immediately. To resolve circular references (e.g. self-referencing objects) that reference counting cannot reclaim, Python employs a cyclic generational garbage collector that inspects objects partitioned into generations 0, 1, and 2.",
      },
    },
  ];

  await prisma.question.createMany({
    data: questionsData,
  });

  console.log(`✅ Seeded ${questionsData.length} questions (3 Single MCQ, 3 Multi-Correct, 2 Coding Monaco, 2 Descriptive).`);

  // Clean up prior responses and events for a fresh testing cycle
  await prisma.examResponse.deleteMany({ where: { examId: exam.id } });
  await prisma.editorTelemetryEvent.deleteMany({ where: { examId: exam.id } });
  await prisma.focusLog.deleteMany({ where: { examId: exam.id } });
  await prisma.proctoringEvent.deleteMany({ where: { examId: exam.id } });

  // Seating assignments for candidate student@proctora.edu (21CS001)
  await prisma.seatingAssignment.deleteMany({ where: { examId: exam.id } });
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
      {
        examId: exam.id,
        rollNumber: "21CS003",
        seatRow: 0,
        seatCol: 2,
        questionSetId: "SET-A",
      },
    ],
  });

  console.log("✅ Seating plan seeded with student 21CS001 (student@proctora.edu).");
  console.log("🎉 'Morgan Stanley OA' is ready for candidate assessment testing!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error creating Morgan Stanley OA:", err);
    process.exit(1);
  });
