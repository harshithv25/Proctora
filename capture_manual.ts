import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/user_manual_screenshots");

async function captureAllSteps() {
  console.log("🚀 Starting Automated Screenshot Capture for Proctora User Manual...");

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["camera", "microphone"],
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // FLOW 1: SYSTEM LANDING & PUBLIC NAVIGATION
    // -------------------------------------------------------------
    console.log("📸 [Step 1.1] Capturing Landing Page...");
    await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_01_landing_page.png"), fullPage: false });

    // -------------------------------------------------------------
    // FLOW 2: USER REGISTRATION & AUTHENTICATION
    // -------------------------------------------------------------
    console.log("📸 [Step 2.1] Capturing Candidate Registration Page...");
    await page.goto("http://localhost:5173/register", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    if (await page.$("#reg-name")) {
      await page.fill("#reg-name", "John Doe");
      await page.fill("#reg-email", "john.doe@nitk.edu.in");
      await page.fill("#reg-roll", "241IT999");
      await page.fill("#reg-password", "Password@123");
      await page.fill("#reg-confirm", "Password@123");
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_02_registration_page.png"), fullPage: false });

    console.log("📸 [Step 2.2] Capturing Candidate Login Page...");
    await page.goto("http://localhost:5173/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.fill("#login-email", "student@proctora.edu");
    await page.fill("#login-password", "Student@12345");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_03_login_page.png"), fullPage: false });

    // Log in as candidate
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // FLOW 3: CANDIDATE EXAM EXPERIENCE
    // -------------------------------------------------------------
    console.log("📸 [Step 3.1] Capturing Candidate Dashboard...");
    await page.fill('#candidate-exam-input, input[placeholder*="TEST-XXXXXX" i]', "TEST-MS2026");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_04_candidate_dashboard.png"), fullPage: false });

    console.log("📸 [Step 3.2] Capturing Device Check & AI Calibration...");
    await page.goto("http://localhost:5173/exams/TEST-MS2026/device-check", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_05_device_check_calibration.png"), fullPage: false });

    // Enter Exam Portal via direct URL or Proceed button
    console.log("Entering Candidate Exam Portal...");
    await page.goto("http://localhost:5173/exams/TEST-MS2026/portal", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    console.log("📸 [Step 3.3] Capturing Candidate Exam Portal (Overview & MCQ Single)...");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_06_exam_portal_overview.png"), fullPage: false });

    // Answer Q1 (MCQ Single)
    console.log("📸 [Step 3.4] Answering Single Choice Question...");
    const mcqOpt = page.locator('label:has-text("O(log N)")').first();
    if (await mcqOpt.isVisible()) {
      await mcqOpt.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_07_exam_mcq_single.png"), fullPage: false });

    // Navigate to Q4 (MSQ)
    console.log("Navigating to Question 4 (Multi-Correct)...");
    const q4Btn = page.locator('.palette-btn:has-text("4"), button:has-text("4")').first();
    if (await q4Btn.isVisible()) {
      await q4Btn.click();
    } else {
      for (let i = 0; i < 3; i++) {
        const nextBtn = page.locator('button:has-text("Next")');
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(400);
        }
      }
    }
    await page.waitForTimeout(1000);

    console.log("📸 [Step 3.5] Answering Multi-Correct Question...");
    const opt1 = page.locator('label:has-text("Dijkstra\'s Algorithm")').first();
    const opt2 = page.locator('label:has-text("Bellman-Ford Algorithm")').first();
    if (await opt1.isVisible()) await opt1.click();
    if (await opt2.isVisible()) await opt2.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_08_exam_multi_correct.png"), fullPage: false });

    // Navigate to Q7 (Coding)
    console.log("Navigating to Question 7 (Coding with Monaco)...");
    const q7Btn = page.locator('.palette-btn:has-text("7"), button:has-text("7")').first();
    if (await q7Btn.isVisible()) {
      await q7Btn.click();
    } else {
      for (let i = 0; i < 3; i++) {
        const nextBtn = page.locator('button:has-text("Next")');
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(400);
        }
      }
    }
    await page.waitForTimeout(1500);

    console.log("📸 [Step 3.6] Typing in Monaco Code Editor with Telemetry...");
    const twoSumCode = `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`;
    const monaco = page.locator(".monaco-editor").first();
    if (await monaco.isVisible()) {
      await monaco.click();
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type(twoSumCode, { delay: 10 });
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_09_exam_coding_monaco.png"), fullPage: false });

    // Navigate to Q9 (Descriptive)
    console.log("Navigating to Question 9 (Descriptive)...");
    const q9Btn = page.locator('.palette-btn:has-text("9"), button:has-text("9")').first();
    if (await q9Btn.isVisible()) {
      await q9Btn.click();
    } else {
      for (let i = 0; i < 2; i++) {
        const nextBtn = page.locator('button:has-text("Next")');
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(400);
        }
      }
    }
    await page.waitForTimeout(1000);

    console.log("📸 [Step 3.7] Answering Descriptive Question...");
    const occAnswer = "Optimistic Concurrency Control assumes conflict probability is low and performs validation at transaction commit time. In contrast, Pessimistic Locking holds locks from initiation, guaranteeing zero race conditions at the cost of concurrency.";
    const textArea = page.locator("textarea.descriptive-textarea").first();
    if (await textArea.isVisible()) {
      await textArea.fill(occAnswer);
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_10_exam_descriptive.png"), fullPage: false });

    // Trigger Submit Modal
    console.log("📸 [Step 3.8] Triggering Final Submit Modal...");
    const submitBtn = page.locator('button:has-text("Submit Exam")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_11_exam_submit_confirmation.png"), fullPage: false });

      // Confirm submission
      const confirmBtn = page.locator('.modal-card button:has-text("Confirm & Submit Exam"), button:has-text("Confirm & Submit Exam")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForURL("**/submitted", { timeout: 15000 });
        await page.waitForTimeout(1500);
      }
    }

    console.log("📸 [Step 3.9] Capturing Exam Submission Receipt Page...");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_12_exam_submitted_receipt.png"), fullPage: false });

    // -------------------------------------------------------------
    // FLOW 4: ADMINISTRATOR / INSTRUCTOR FLOW
    // -------------------------------------------------------------
    console.log("Creating new browser session for Administrator...");
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const adminPage = await adminContext.newPage();

    console.log("📸 [Step 4.1] Capturing Administrator Login...");
    await adminPage.goto("http://localhost:5173/login", { waitUntil: "domcontentloaded" });
    await adminPage.fill("#login-email", "admin@proctora.edu");
    await adminPage.fill("#login-password", "Admin@12345");
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_13_admin_login.png"), fullPage: false });

    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL("**/dashboard", { timeout: 15000 });
    await adminPage.waitForTimeout(1000);

    console.log("📸 [Step 4.2] Capturing Admin Dashboard...");
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_14_admin_dashboard.png"), fullPage: false });

    console.log("📸 [Step 4.3] Capturing Instructor Test Studio (/admin/exams)...");
    await adminPage.goto("http://localhost:5173/admin/exams", { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(2000);
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_15_admin_exams_studio.png"), fullPage: false });

    // Open Create Exam modal or expand Question Bank if available
    const newExamBtn = adminPage.locator('button:has-text("Create New Exam"), button:has-text("New Exam")').first();
    if (await newExamBtn.isVisible()) {
      await newExamBtn.click();
      await adminPage.waitForTimeout(800);
      console.log("📸 [Step 4.4] Capturing Exam Creation Modal...");
      await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_16_admin_create_exam_modal.png"), fullPage: false });
      const closeBtn = adminPage.locator('button:has-text("Cancel"), .modal-close').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }

    console.log("📸 [Step 4.5] Capturing Live Invigilation & Proctoring Monitor...");
    await adminPage.goto("http://localhost:5173/admin/exams/TEST-MS2026/monitor", { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(2500);
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_17_admin_live_monitor.png"), fullPage: false });

    console.log("📸 [Step 4.6] Capturing Candidate Answer Sheet Viewer & Telemetry Flags...");
    const inspectBtn = adminPage.locator('button:has-text("Inspect Sheet"), button:has-text("View Graded Sheet")').first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await adminPage.waitForSelector(".sheet-modal-card", { timeout: 10000 });
      await adminPage.waitForTimeout(1500);
      await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "step_18_admin_sheet_inspector.png"), fullPage: false });
    }

    console.log("🎉 ALL SCREENSHOTS SUCCESSFULLY CAPTURED!");
  } catch (error) {
    console.error("❌ Error during screenshot capture:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureAllSteps();
