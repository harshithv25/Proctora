import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/harshith/.gemini/antigravity-ide/brain/e19c3ff8-e4f0-429e-9e02-6ade1741442d";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  console.log("Logging in as admin...");
  await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
  await page.fill('#login-email', "admin@proctora.edu");
  await page.fill('#login-password', "Admin@12345");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/dashboard", { timeout: 15000 });
  console.log("Admin at /dashboard, navigating to monitor feed...");

  await page.goto("http://localhost:5173/admin/exams/TEST-MS2026/monitor", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("Opening Candidate Answer Sheet...");
  await page.click('button:has-text("Inspect Sheet"), button:has-text("View Graded Sheet")');
  await page.waitForSelector(".sheet-modal-card", { timeout: 10000 });
  await page.waitForTimeout(1500);

  const screenshotPath = path.join(ARTIFACT_DIR, "admin_candidate_answer_sheet.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("📸 Saved high-contrast Screenshot 4 to:", screenshotPath);

  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
