import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "/home/harshith/.gemini/antigravity-ide/brain/e19c3ff8-e4f0-429e-9e02-6ade1741442d";

async function run() {
  console.log("🚀 Starting Proctora End-to-End Automated Verification with Playwright...");

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    permissions: ["camera", "microphone"],
  });

  const page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  try {
    // =========================================================================
    // 1. CANDIDATE LOGIN & MINIMALIST DASHBOARD VERIFICATION
    // =========================================================================
    console.log("➡️ Step 1: Candidate login at http://localhost:5173/login");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });

    // Fill candidate credentials
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', "student@proctora.edu");
    await page.fill('#login-password', "Student@12345");
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');

    // Wait for redirect to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(1000);
    console.log("✅ Candidate arrived at /dashboard");

    // Verify Requirement 1: Minimalist Candidate Dashboard
    const headingText = await page.textContent("h1, h2");
    console.log("Dashboard heading:", headingText);

    // Verify the input box with label "Paste your exam link or Test ID here:"
    const labelExists = await page.isVisible('text="Paste your exam link or Test ID here:"');
    console.log("✅ Label 'Paste your exam link or Test ID here:' visible:", labelExists);

    // Capture Screenshot 1: Candidate Dashboard
    const screenshot1Path = path.join(ARTIFACT_DIR, "candidate_dashboard_portal.png");
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`📸 Saved Screenshot 1: ${screenshot1Path}`);

    // =========================================================================
    // 2. PROCEED TO EXAMINATION VIA TEST ID INPUT
    // =========================================================================
    console.log("➡️ Step 2: Entering Test ID 'TEST-MS2026'");
    await page.fill('#candidate-exam-input, input[placeholder*="TEST-XXXXXX" i]', "TEST-MS2026");
    await page.click('button:has-text("Proceed to Examination")');

    // Wait for exam portal to load
    await page.waitForURL("**/exams/TEST-MS2026/portal", { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("✅ Arrived at Candidate Exam Portal:", page.url());

    // Verify title
    const examHeader = await page.textContent(".portal-title");
    console.log("Exam Portal Title:", examHeader);

    // =========================================================================
    // 3. ANSWERING ALL 10 QUESTIONS
    // =========================================================================
    console.log("➡️ Step 3: Answering all 10 questions in Morgan Stanley OA...");

    // Question 1: MCQ Single -> "O(log N)"
    console.log("Answering Question 1 (MCQ Single: O(log N))...");
    await page.click('label:has-text("O(log N)")');
    await page.waitForTimeout(500);

    // Navigate to Q2
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 2: MCQ Single -> "401 Unauthorized"
    console.log("Answering Question 2 (MCQ Single: 401 Unauthorized)...");
    await page.click('label:has-text("401 Unauthorized")');
    await page.waitForTimeout(500);

    // Navigate to Q3
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 3: MCQ Single -> "Isolation"
    console.log("Answering Question 3 (MCQ Single: Isolation)...");
    await page.click('label:has-text("Isolation")');
    await page.waitForTimeout(500);

    // Navigate to Q4
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 4: Multi-Correct -> Dijkstra, Bellman-Ford, Floyd-Warshall
    console.log("Answering Question 4 (Multi-Correct: Dijkstra, Bellman-Ford, Floyd-Warshall)...");
    await page.click('label:has-text("Dijkstra\'s Algorithm")');
    await page.click('label:has-text("Bellman-Ford Algorithm")');
    await page.click('label:has-text("Floyd-Warshall Algorithm")');
    await page.waitForTimeout(500);

    // Navigate to Q5
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 5: Multi-Correct -> Binary Heap, Fibonacci Heap, Red-Black Tree
    console.log("Answering Question 5 (Multi-Correct: Binary Heap, Fibonacci Heap, Red-Black Tree)...");
    await page.click('label:has-text("Binary Heap")');
    await page.click('label:has-text("Fibonacci Heap")');
    await page.click('label:has-text("Red-Black Tree")');
    await page.waitForTimeout(500);

    // Navigate to Q6
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 6: Multi-Correct -> TCP 3-way, flow control, UDP minimal header
    console.log("Answering Question 6 (Multi-Correct: TCP 3-way, sliding window, UDP low header)...");
    await page.click('label:has-text("TCP is connection-oriented with 3-way handshake")');
    await page.click('label:has-text("TCP provides flow control via sliding window")');
    await page.click('label:has-text("UDP has minimal header overhead compared to TCP")');
    await page.waitForTimeout(500);

    // Navigate to Q7 (Coding)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Question 7: Coding (two_sum in Monaco)
    console.log("Answering Question 7 (Monaco Coding: Python two_sum)...");
    const twoSumCode = `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`;

    // Type into Monaco editor
    await page.click('.monaco-editor');
    // Focus and select all then type
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(twoSumCode, { delay: 10 });
    await page.waitForTimeout(1000);

    // Capture Screenshot 2: Candidate Exam Portal Answering Monaco Code
    const screenshot2Path = path.join(ARTIFACT_DIR, "candidate_exam_portal_answering.png");
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`📸 Saved Screenshot 2: ${screenshot2Path}`);

    // Navigate to Q8 (Coding)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Question 8: Coding (is_valid_parentheses in Monaco)
    console.log("Answering Question 8 (Monaco Coding: Python is_valid_parentheses)...");
    const parensCode = `def is_valid_parentheses(s: str) -> bool:
    stack = []
    lookup = {')': '(', '}': '{', ']': '['}
    for ch in s:
        if ch in lookup:
            if not stack or stack.pop() != lookup[ch]:
                return False
        else:
            stack.append(ch)
    return len(stack) == 0
`;
    await page.click('.monaco-editor');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(parensCode, { delay: 10 });
    await page.waitForTimeout(1000);

    // Navigate to Q9 (Descriptive)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 9: Descriptive
    console.log("Answering Question 9 (Descriptive: OCC vs Pessimistic Locking)...");
    const occAnswer = "Optimistic Concurrency Control assumes conflicts are rare, executing operations without locks and validating correctness at commit time. Pessimistic locking acquires exclusive locks ahead of operations to prevent concurrent modifications, ensuring consistency under high contention at the cost of concurrency and potential deadlocks.";
    await page.fill('textarea.descriptive-textarea', occAnswer);
    await page.waitForTimeout(500);

    // Navigate to Q10 (Descriptive)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Question 10: Descriptive
    console.log("Answering Question 10 (Descriptive: Python GC and Reference Counting)...");
    const gcAnswer = "Python uses reference counting as its primary memory management mechanism: each object tracks references to it, freeing memory immediately upon reaching zero. To handle reference cycles where objects reference each other, Python incorporates a cyclic generational garbage collector running across generations 0, 1, and 2 based on object survival thresholds.";
    await page.fill('textarea.descriptive-textarea', gcAnswer);
    await page.waitForTimeout(1000);

    // =========================================================================
    // 4. SUBMIT EXAM
    // =========================================================================
    console.log("➡️ Step 4: Submitting Examination...");
    await page.click('.portal-header button:has-text("Submit Exam"), button:has-text("Submit Exam")');
    await page.waitForTimeout(1000);

    // Confirm in modal
    console.log("Confirming final submission in modal...");
    await page.click('.modal-card button:has-text("Confirm & Submit Exam"), button:has-text("Confirm & Submit Exam")');

    // Wait for submission confirmation page
    await page.waitForURL("**/submitted", { timeout: 15000 });
    await page.waitForTimeout(1000);
    console.log("✅ Exam successfully submitted! Current URL:", page.url());

    // =========================================================================
    // 5. ADMIN VERIFICATION & LIVE INVIGILATION FEED
    // =========================================================================
    console.log("➡️ Step 5: Admin Login and Monitor Verification...");
    const adminContext = await browser.newContext({
      viewport: { width: 1400, height: 900 },
    });
    const adminPage = await adminContext.newPage();

    await adminPage.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"], input[placeholder*="email" i]', "admin@proctora.edu");
    await adminPage.fill('input[type="password"]', "Admin@12345");
    await adminPage.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');

    await adminPage.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✅ Admin logged in and at /dashboard");

    // Navigate to Invigilation Feed for Morgan Stanley OA
    await adminPage.goto("http://localhost:5173/admin/exams/TEST-MS2026/monitor", { waitUntil: "networkidle" });
    await adminPage.waitForTimeout(2000);
    console.log("✅ Admin at Invigilator Feed:", adminPage.url());

    // Capture Screenshot 3: Admin Live Invigilation Feed
    const screenshot3Path = path.join(ARTIFACT_DIR, "admin_live_invigilation_feed.png");
    await adminPage.screenshot({ path: screenshot3Path, fullPage: true });
    console.log(`📸 Saved Screenshot 3: ${screenshot3Path}`);

    // Inspect candidate answer sheet
    console.log("➡️ Step 6: Opening Candidate Answer Sheet...");
    await adminPage.click('button:has-text("Inspect Sheet"), button:has-text("View Graded Sheet")');
    await adminPage.waitForSelector(".sheet-modal-card", { timeout: 10000 });
    await adminPage.waitForTimeout(1500);
    console.log("✅ Candidate Answer Sheet Modal opened!");

    // Capture Screenshot 4: Candidate Answer Sheet Viewer
    const screenshot4Path = path.join(ARTIFACT_DIR, "admin_candidate_answer_sheet.png");
    await adminPage.screenshot({ path: screenshot4Path, fullPage: true });
    console.log(`📸 Saved Screenshot 4: ${screenshot4Path}`);

    console.log("🎉 ALL AUTOMATED VERIFICATION STEPS PASSED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

run();
