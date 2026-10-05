import test, { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Backend Unit Tests: Exam Delivery & Proctoring Controls', () => {

  describe('Pre-Flight Device Check Validation', () => {
    function evaluateDeviceCheck(data: {
      browserInfo: string;
      screenResolution: string;
      webcamAvailable: boolean;
      microphoneAvailable: boolean;
    }) {
      const passed = data.webcamAvailable && data.microphoneAvailable;
      return {
        passed,
        details: {
          webcam: data.webcamAvailable ? 'ok' : 'not detected',
          microphone: data.microphoneAvailable ? 'ok' : 'not detected',
          browser: data.browserInfo,
          resolution: data.screenResolution,
        },
      };
    }

    it('should pass diagnostic when both webcam and microphone are detected', () => {
      const diagnostic = evaluateDeviceCheck({
        browserInfo: 'Chrome 122.0.0',
        screenResolution: '1920x1080',
        webcamAvailable: true,
        microphoneAvailable: true,
      });

      assert.strictEqual(diagnostic.passed, true);
      assert.strictEqual(diagnostic.details.webcam, 'ok');
      assert.strictEqual(diagnostic.details.microphone, 'ok');
    });

    it('should fail diagnostic if webcam is missing or inaccessible', () => {
      const diagnostic = evaluateDeviceCheck({
        browserInfo: 'Firefox 120.0',
        screenResolution: '1920x1080',
        webcamAvailable: false,
        microphoneAvailable: true,
      });

      assert.strictEqual(diagnostic.passed, false);
      assert.strictEqual(diagnostic.details.webcam, 'not detected');
    });

    it('should fail diagnostic if microphone is missing', () => {
      const diagnostic = evaluateDeviceCheck({
        browserInfo: 'Edge 121.0',
        screenResolution: '1366x768',
        webcamAvailable: true,
        microphoneAvailable: false,
      });

      assert.strictEqual(diagnostic.passed, false);
      assert.strictEqual(diagnostic.details.microphone, 'not detected');
    });
  });

  describe('Exam Timing & Window Access Controls', () => {
    function checkExamAccess(startTimeStr?: string, endTimeStr?: string, currentTime = new Date()) {
      const EARLY_ENTRY_BUFFER_MS = 60 * 1000; // 1 minute early entry buffer
      const now = currentTime.getTime();

      if (startTimeStr) {
        const start = new Date(startTimeStr).getTime();
        if (now < start - EARLY_ENTRY_BUFFER_MS) {
          const diffMinutes = Math.ceil((start - now) / 60000);
          return { allowed: false, reason: `Exam has not started yet. Begins in ${diffMinutes} min.` };
        }
      }

      if (endTimeStr) {
        const end = new Date(endTimeStr).getTime();
        if (now > end) {
          return { allowed: false, reason: 'Examination window has closed.' };
        }
      }

      return { allowed: true, reason: 'Access granted.' };
    }

    it('should allow candidate access within the active exam window', () => {
      const now = new Date('2026-10-05T10:15:00Z');
      const start = '2026-10-05T10:00:00Z';
      const end = '2026-10-05T11:30:00Z';

      const result = checkExamAccess(start, end, now);
      assert.strictEqual(result.allowed, true);
    });

    it('should permit access 30 seconds before start time due to 1-minute buffer', () => {
      const start = new Date('2026-10-05T10:00:00Z');
      const earlyAccess = new Date(start.getTime() - 45000); // 45 seconds before

      const result = checkExamAccess(start.toISOString(), undefined, earlyAccess);
      assert.strictEqual(result.allowed, true, 'Early access within 1 min buffer should be permitted');
    });

    it('should reject access 5 minutes before scheduled start time', () => {
      const start = new Date('2026-10-05T10:00:00Z');
      const tooEarly = new Date(start.getTime() - 300000); // 5 minutes before

      const result = checkExamAccess(start.toISOString(), undefined, tooEarly);
      assert.strictEqual(result.allowed, false);
      assert.match(result.reason, /not started yet/);
    });

    it('should reject access after scheduled exam conclusion', () => {
      const start = '2026-10-05T10:00:00Z';
      const end = '2026-10-05T11:00:00Z';
      const late = new Date('2026-10-05T11:05:00Z');

      const result = checkExamAccess(start, end, late);
      assert.strictEqual(result.allowed, false);
      assert.match(result.reason, /closed/);
    });
  });

  describe('Question Ordering Delivery & Sanitization', () => {
    it('should sanitize questions before candidate delivery (hide solution/metadata)', () => {
      const rawQuestions = [
        {
          id: 'q1',
          type: 'mcq',
          content: 'What is 2 + 2?',
          order: 0,
          metadata: { options: ['1', '2', '4', '8'], correctAnswer: '4', explanation: 'Math' }
        }
      ];

      const candidateQuestions = rawQuestions.map(q => ({
        id: q.id,
        type: q.type,
        content: q.content,
        order: q.order,
        options: (q.metadata as any)?.options,
        // correctAnswer and explanation omitted
      }));

      assert.strictEqual(candidateQuestions[0].id, 'q1');
      assert.strictEqual((candidateQuestions[0] as any).correctAnswer, undefined);
      assert.strictEqual((candidateQuestions[0] as any).explanation, undefined);
      assert.deepStrictEqual(candidateQuestions[0].options, ['1', '2', '4', '8']);
    });
  });
});
