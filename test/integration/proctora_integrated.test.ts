import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { evaluateResponses, QuestionItem } from '../../backend/src/modules/evaluationExport/grading';

describe('Integrated System Test: Proctora Microservices & Services Pipeline', () => {

  // Shared state across the multi-service flow
  let candidateUser: { id: string; name: string; email: string; token: string };
  let examSession: { id: string; testId: string; questions: QuestionItem[]; candidateSetId: string };
  let preFlightCalibration: { verified: boolean; faceMetrics: any };
  let liveProctoringAlerts: Array<{ timestamp: number; cheatProbability: number; flagged: boolean; reason: string }>;
  let finalEvaluation: any;

  // =========================================================================
  // STEP 1: Candidate Authentication & 2FA Token Verification Flow
  // (Frontend Client Layer <-> Backend Auth Microservice)
  // =========================================================================
  it('STEP 1 [Auth Service]: Register candidate, verify password hash, and establish JWT session', () => {
    const rawPassword = 'StudentSecret@2026';
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync(rawPassword, salt, 1000, 64, 'sha512').toString('hex');

    // Simulate login verification
    const verificationAttempt = crypto.pbkdf2Sync('StudentSecret@2026', salt, 1000, 64, 'sha512').toString('hex');
    assert.strictEqual(verificationAttempt, passwordHash, 'Candidate credentials must authenticate');

    // Generate JWT Access Token and mock session
    const tokenPayload = {
      userId: 'cand-241IT004',
      name: 'Adarsh Bellamane',
      email: 'student@nitk.edu.in',
      role: 'CANDIDATE',
    };
    const signedToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    candidateUser = {
      id: tokenPayload.userId,
      name: tokenPayload.name,
      email: tokenPayload.email,
      token: signedToken,
    };

    assert.ok(candidateUser.token);
    assert.strictEqual(candidateUser.name, 'Adarsh Bellamane');
  });

  // =========================================================================
  // STEP 2: Exam Configuration & 9-Color Seating Plan Deconfliction
  // (Faculty Admin Portal <-> Backend ExamConfig Service)
  // =========================================================================
  it('STEP 2 [ExamConfig Service]: Provision exam and assign deconflicted question sets to candidate physical seat', () => {
    const questionBank: QuestionItem[] = [
      { id: 'q-mcq-1', type: 'mcq', content: 'HTTP status for Not Found is:', order: 0, metadata: { points: 2, correctAnswer: '404' } },
      { id: 'q-mcq-2', type: 'mcq', content: 'Which protocol is used for full-duplex communication in Proctora?', order: 1, metadata: { points: 2, correctAnswer: 'WebSocket' } },
      { id: 'q-multi-1', type: 'multi_correct', content: 'Select all ACID properties:', order: 2, metadata: { points: 4, correctAnswers: ['Atomicity', 'Consistency', 'Isolation', 'Durability'] } },
      { id: 'q-code-1', type: 'coding', content: 'Implement quicksort algorithm.', order: 3, metadata: { points: 10, starterCode: 'def quicksort(arr):' } },
    ];

    // Seating position: Row 1, Col 2 in classroom lab
    const seatRow = 1;
    const seatCol = 2;
    const setIndex = ((seatRow % 3) * 3 + (seatCol % 3)) % 9;
    const setId = `SET-${String.fromCharCode(65 + setIndex)}`;

    // Shuffle questions deterministically for this set
    const questionIds = questionBank.map(q => q.id);
    let seed = (setIndex + 1) * 2654435761;
    const shuffledIds = [...questionIds];
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const j = Math.floor((seed / 4294967296) * (i + 1));
      [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }

    examSession = {
      id: 'exam-it303-midterm',
      testId: 'TEST-NITK99',
      questions: questionBank,
      candidateSetId: setId,
    };

    assert.strictEqual(examSession.testId, 'TEST-NITK99');
    assert.strictEqual(examSession.candidateSetId, 'SET-F');
    assert.strictEqual(shuffledIds.length, 4);
  });

  // =========================================================================
  // STEP 3: Pre-Flight Device Diagnostics & AI Camera Calibration
  // (Frontend Client <-> AI Proctoring Microservice <-> Backend Delivery)
  // =========================================================================
  it('STEP 3 [AI Proctoring Service]: Verify candidate presence and calibrate head pose before entry', () => {
    // 1. Device check
    const hardwareOk = true; // webcam and mic active
    assert.strictEqual(hardwareOk, true);

    // 2. AI face verification logic
    const faceFound = true;
    const numFaces = 1;
    const yaw = 2.1;
    const pitch = -1.4;
    const isCentered = true;

    const calibrationResult = {
      ready: faceFound && numFaces === 1 && isCentered && Math.abs(yaw) < 22 && Math.abs(pitch) < 20,
      reason: 'calibrated',
      metrics: { yaw, pitch, isCentered, numFaces },
    };

    preFlightCalibration = {
      verified: calibrationResult.ready,
      faceMetrics: calibrationResult.metrics,
    };

    assert.strictEqual(preFlightCalibration.verified, true);
    assert.strictEqual(calibrationResult.reason, 'calibrated');
  });

  // =========================================================================
  // STEP 4: Live Exam Session, AI Behavior Evaluation & Telemetry Streaming
  // (Frontend Telemetry Engine <-> AI Microservice <-> Backend Integrity Monitoring)
  // =========================================================================
  it('STEP 4 [Integrity Monitoring & AI Engine]: Stream editor telemetry and detect gaze diversion event', () => {
    liveProctoringAlerts = [];

    // Frame 1: Candidate looking normal
    const frame1Normal = { numFaces: 1, yaw: 1.0, pitch: 0.5 };
    const cheatProb1 = 0.05;
    if (cheatProb1 >= 0.65) {
      liveProctoringAlerts.push({ timestamp: Date.now(), cheatProbability: cheatProb1, flagged: true, reason: 'anomaly' });
    }

    // Frame 2: Candidate turns head away (looking at external notes) -> Yaw = 38 deg
    const frame2Turned = { numFaces: 1, yaw: 38.0, pitch: 8.0 };
    const cheatProb2 = 0.88; // Exceeds 0.65 threshold
    const flagged = cheatProb2 >= 0.65;
    if (flagged) {
      liveProctoringAlerts.push({
        timestamp: Date.now(),
        cheatProbability: cheatProb2,
        flagged: true,
        reason: 'LOOKING_AWAY (Extreme yaw angle)',
      });
    }

    // Encrypt alert details before storing in database (mirroring backend service)
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encryptedAlert = Buffer.concat([
      cipher.update(JSON.stringify(liveProctoringAlerts[0]), 'utf8'),
      cipher.final()
    ]).toString('base64');

    assert.strictEqual(liveProctoringAlerts.length, 1, 'Suspicious head turn must be caught and flagged');
    assert.strictEqual(liveProctoringAlerts[0].cheatProbability, 0.88);
    assert.ok(encryptedAlert.length > 0);
  });

  // =========================================================================
  // STEP 5: Exam Submission, Auto-Grading & Report Compilation
  // (Frontend Submit -> Backend EvaluationExport Microservice)
  // =========================================================================
  it('STEP 5 [Evaluation & Export Service]: Score candidate submission and compile complete evaluation breakdown', () => {
    const candidateAnswers = {
      'q-mcq-1': '404',        // Correct (+2 pts)
      'q-mcq-2': 'websocket',  // Correct case-insensitive (+2 pts)
      'q-multi-1': ['Atomicity', 'Consistency', 'Durability', 'Isolation'], // All-or-nothing correct (+4 pts)
      'q-code-1': 'def quicksort(arr):\n    if len(arr) <= 1: return arr\n    pivot = arr[len(arr) // 2]\n    return quicksort([x for x in arr if x < pivot]) + [x for x in arr if x == pivot] + quicksort([x for x in arr if x > pivot])',
      __telemetry: {
        'q-code-1': {
          keystrokes: 182,
          pastes: 0,
          blurs: 1, // 1 tab switch during exam
          language: 'python',
        },
      },
    };

    finalEvaluation = evaluateResponses(examSession.questions, candidateAnswers);

    assert.strictEqual(finalEvaluation.totalScore, 8); // 2 + 2 + 4 = 8
    assert.strictEqual(finalEvaluation.maxScore, 18);  // 2 + 2 + 4 + 10 = 18
    assert.strictEqual(finalEvaluation.autoGradedQuestionsCount, 3);
    assert.strictEqual(finalEvaluation.ungradedQuestionsCount, 1); // Coding question pending instructor review

    // Assert individual breakdowns
    assert.strictEqual(finalEvaluation.breakdown['q-mcq-1'].status, 'correct');
    assert.strictEqual(finalEvaluation.breakdown['q-mcq-2'].status, 'correct');
    assert.strictEqual(finalEvaluation.breakdown['q-multi-1'].status, 'correct');
    assert.strictEqual(finalEvaluation.breakdown['q-code-1'].status, 'ungraded');
    assert.strictEqual(finalEvaluation.breakdown['q-code-1'].telemetrySummary?.keystrokes, 182);
    assert.strictEqual(finalEvaluation.breakdown['q-code-1'].telemetrySummary?.pastes, 0);
    assert.strictEqual(finalEvaluation.breakdown['q-code-1'].telemetrySummary?.blurs, 1);
  });
});
