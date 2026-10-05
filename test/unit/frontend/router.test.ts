import test, { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Frontend Unit Tests: Client-Side Router Module', () => {

  // Replicating matchRoute logic from frontend/src/lib/router.svelte.ts
  interface RouteMatch {
    component: any;
    params: Record<string, string>;
  }

  function matchRoute(path: string, routes: Record<string, any>): RouteMatch | null {
    const cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/';

    // 1. Direct match
    if (routes[cleanPath]) {
      return { component: routes[cleanPath], params: {} };
    }

    const pathSegments = cleanPath.split('/').filter(Boolean);

    // 2. Pattern match
    for (const [pattern, component] of Object.entries(routes)) {
      const patternSegments = pattern.split('/').filter(Boolean);
      if (patternSegments.length !== pathSegments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;

      for (let i = 0; i < patternSegments.length; i++) {
        const pSeg = patternSegments[i];
        const uSeg = pathSegments[i];

        if (pSeg.startsWith(':')) {
          const paramName = pSeg.slice(1);
          params[paramName] = decodeURIComponent(uSeg);
        } else if (pSeg !== uSeg) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return { component, params };
      }
    }

    // 3. Fallback/wildcard match
    if (routes['*']) {
      return { component: routes['*'], params: {} };
    }

    return null;
  }

  // Exact route table registered in frontend/src/App.svelte
  const appRoutes = {
    '/': 'LandingPage',
    '/login': 'LoginPage',
    '/register': 'RegisterPage',
    '/2fa-setup': 'TwoFactorSetupPage',
    '/dashboard': 'DashboardPage',
    '/exams/:examId/device-check': 'DeviceCheckPage',
    '/exams/:examId/portal': 'ExamPortalPage',
    '/exams/:examId/submitted': 'ExamSubmittedPage',
    '/admin/exams': 'AdminExamsPage',
    '/admin/exams/:examId/monitor': 'AdminMonitorPage',
    '*': 'NotFoundPage',
  };

  it('should match root path "/" directly to LandingPage', () => {
    const match = matchRoute('/', appRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'LandingPage');
    assert.deepStrictEqual(match.params, {});
  });

  it('should match direct static authentication routes ("/login", "/register")', () => {
    const loginMatch = matchRoute('/login', appRoutes);
    assert.ok(loginMatch);
    assert.strictEqual(loginMatch.component, 'LoginPage');

    const registerMatch = matchRoute('/register', appRoutes);
    assert.ok(registerMatch);
    assert.strictEqual(registerMatch.component, 'RegisterPage');
  });

  it('should extract dynamic route parameters for exam delivery routes', () => {
    const match = matchRoute('/exams/TEST-NITK101/portal', appRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'ExamPortalPage');
    assert.strictEqual(match.params.examId, 'TEST-NITK101');

    const deviceMatch = matchRoute('/exams/exam-7788/device-check', appRoutes);
    assert.ok(deviceMatch);
    assert.strictEqual(deviceMatch.component, 'DeviceCheckPage');
    assert.strictEqual(deviceMatch.params.examId, 'exam-7788');
  });

  it('should extract dynamic route parameters for administrative live monitor', () => {
    const match = matchRoute('/admin/exams/exam-12345/monitor', appRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'AdminMonitorPage');
    assert.strictEqual(match.params.examId, 'exam-12345');
  });

  it('should strip query parameters and trailing slashes cleanly on root and subroutes', () => {
    const rootMatch = matchRoute('/?ref=portal&src=web', appRoutes);
    assert.ok(rootMatch);
    assert.strictEqual(rootMatch.component, 'LandingPage');

    const dashMatch = matchRoute('/dashboard/?tab=results', appRoutes);
    assert.ok(dashMatch);
    assert.strictEqual(dashMatch.component, 'DashboardPage');
  });

  it('should fallback to wildcard route for unrecognized paths', () => {
    const match = matchRoute('/non-existent/deep/route', appRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'NotFoundPage');
  });
});
