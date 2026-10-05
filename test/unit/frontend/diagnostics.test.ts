import test, { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Frontend Unit Tests: Pre-Flight Device Diagnostics Module', () => {

  interface DiagnosticCriteria {
    webcam: boolean;
    microphone: boolean;
    screenWidth: number;
    screenHeight: number;
    browser: string;
  }

  function runDiagnostics(criteria: DiagnosticCriteria) {
    const MIN_WIDTH = 1024;
    const MIN_HEIGHT = 700;
    const SUPPORTED_BROWSERS = ['chrome', 'firefox', 'edge', 'chromium'];

    const webcamOk = criteria.webcam;
    const micOk = criteria.microphone;
    const resolutionOk = criteria.screenWidth >= MIN_WIDTH && criteria.screenHeight >= MIN_HEIGHT;
    const browserNormalized = criteria.browser.toLowerCase();
    const browserOk = SUPPORTED_BROWSERS.some(b => browserNormalized.includes(b));

    const allPassed = webcamOk && micOk && resolutionOk && browserOk;

    return {
      allPassed,
      checks: {
        webcam: webcamOk,
        microphone: micOk,
        resolution: resolutionOk,
        browser: browserOk,
      },
    };
  }

  it('should pass all checks for a standard desktop laptop with webcam and mic', () => {
    const result = runDiagnostics({
      webcam: true,
      microphone: true,
      screenWidth: 1920,
      screenHeight: 1080,
      browser: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    });

    assert.strictEqual(result.allPassed, true);
    assert.strictEqual(result.checks.webcam, true);
    assert.strictEqual(result.checks.microphone, true);
    assert.strictEqual(result.checks.resolution, true);
    assert.strictEqual(result.checks.browser, true);
  });

  it('should fail if screen resolution is below minimum operational dimensions', () => {
    const result = runDiagnostics({
      webcam: true,
      microphone: true,
      screenWidth: 800, // Too small
      screenHeight: 600,
      browser: 'Chrome/122.0.0.0',
    });

    assert.strictEqual(result.allPassed, false);
    assert.strictEqual(result.checks.resolution, false);
    assert.strictEqual(result.checks.webcam, true);
  });

  it('should fail if webcam stream permission is denied or camera absent', () => {
    const result = runDiagnostics({
      webcam: false,
      microphone: true,
      screenWidth: 1440,
      screenHeight: 900,
      browser: 'Firefox/124.0',
    });

    assert.strictEqual(result.allPassed, false);
    assert.strictEqual(result.checks.webcam, false);
  });

  it('should fail if unsupported browser is detected', () => {
    const result = runDiagnostics({
      webcam: true,
      microphone: true,
      screenWidth: 1920,
      screenHeight: 1080,
      browser: 'OperaMini/7.0 (Legacy Browser)',
    });

    assert.strictEqual(result.allPassed, false);
    assert.strictEqual(result.checks.browser, false);
  });
});
