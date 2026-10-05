import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Frontend Unit Tests: Landing Page & Academic Metadata Module', () => {

  const landingPagePath = path.resolve(__dirname, '../../../frontend/src/pages/LandingPage.svelte');
  const landingPageSource = fs.readFileSync(landingPagePath, 'utf8');

  it('should include the project brand title "proctora" with clean styling', () => {
    assert.match(landingPageSource, /<h1 class="project-title">\s*proctora\s*<\/h1>/);
    assert.match(landingPageSource, /Real-Time Online Examination System with Proctoring/);
  });

  it('should specify that the project is for IT303 : Software Engineering under the main logo', () => {
    assert.match(
      landingPageSource,
      /This project is for the course IT303 : Software Engineering/,
      'Must contain exact course affiliation text under the main logo'
    );
  });

  it('should prominently list all three project authors with their respective roll numbers', () => {
    // Author 1: Adarsh Bellamane 241IT004
    assert.match(landingPageSource, /Adarsh Bellamane/);
    assert.match(landingPageSource, /241IT004/);

    // Author 2: Harshith Vellapha 241IT033
    assert.match(landingPageSource, /Harshith Vellapha/);
    assert.match(landingPageSource, /241IT033/);

    // Author 3: Rushi Patel 241IT065
    assert.match(landingPageSource, /Rushi Patel/);
    assert.match(landingPageSource, /241IT065/);
  });

  it('should display the course instructor credit for Jaidhar C.D.', () => {
    assert.match(landingPageSource, /Course Instructor\s*:/);
    assert.match(landingPageSource, /Jaidhar C\.D\./);
  });

  it('should include copyright notice with the copyright symbol at the bottom', () => {
    assert.match(
      landingPageSource,
      /(&copy;|©)\s*2026 Proctora/i,
      'Footer must include the copyright symbol and year'
    );
    assert.match(landingPageSource, /All rights reserved/i);
  });

  it('should provide navigation entry points to candidate portal and registration', () => {
    assert.match(landingPageSource, /push\('\/login'\)/);
    assert.match(landingPageSource, /push\('\/register'\)/);
  });
});
