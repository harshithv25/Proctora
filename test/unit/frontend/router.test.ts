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

  const dummyRoutes = {
    '/': 'HomePage',
    '/login': 'LoginPage',
    '/dashboard': 'DashboardPage',
    '/exam/:id': 'ExamPortalPage',
    '/admin/exams/:examId/monitor': 'AdminMonitorPage',
    '*': 'NotFoundPage',
  };

  it('should match direct static routes exactly', () => {
    const match = matchRoute('/login', dummyRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'LoginPage');
    assert.deepStrictEqual(match.params, {});
  });

  it('should extract dynamic route parameters for single parameter routes', () => {
    const match = matchRoute('/exam/TEST-XYZ890', dummyRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'ExamPortalPage');
    assert.strictEqual(match.params.id, 'TEST-XYZ890');
  });

  it('should extract dynamic route parameters for nested routes', () => {
    const match = matchRoute('/admin/exams/exam-12345/monitor', dummyRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'AdminMonitorPage');
    assert.strictEqual(match.params.examId, 'exam-12345');
  });

  it('should strip query parameters and trailing slashes cleanly', () => {
    const match = matchRoute('/dashboard/?tab=results&view=full', dummyRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'DashboardPage');
  });

  it('should fallback to wildcard route for unrecognized paths', () => {
    const match = matchRoute('/non-existent/deep/route', dummyRoutes);
    assert.ok(match);
    assert.strictEqual(match.component, 'NotFoundPage');
  });
});
