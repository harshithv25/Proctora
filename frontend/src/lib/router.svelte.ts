export interface RouteMatch {
  component: any;
  params: Record<string, string>;
}

export type RoutesMap = Record<string, any>;

class RouterState {
  path = $state(typeof window !== 'undefined' ? window.location.pathname : '/');
}

export const router = new RouterState();

export function getPath(): string {
  return router.path;
}

export function push(url: string) {
  if (url.startsWith('#/')) {
    url = url.slice(1);
  }
  if (!url.startsWith('/')) {
    url = '/' + url;
  }
  if (typeof window !== 'undefined' && window.location.pathname !== url) {
    window.history.pushState({}, '', url);
    router.path = url;
  }
}

export function replace(url: string) {
  if (url.startsWith('#/')) {
    url = url.slice(1);
  }
  if (!url.startsWith('/')) {
    url = '/' + url;
  }
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', url);
    router.path = url;
  }
}

export function matchRoute(path: string, routes: RoutesMap): RouteMatch | null {
  // Normalize path
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

  // 3. Fallback/wildcard match if present
  if (routes['*']) {
    return { component: routes['*'], params: {} };
  }

  return null;
}

export function initRouter() {
  if (typeof window === 'undefined') return () => {};

  // Check if loaded with legacy hash (e.g. /#/login) and convert to clean path
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const cleanFromHash = window.location.hash.slice(1);
    window.history.replaceState({}, '', cleanFromHash);
    router.path = cleanFromHash;
  }

  const handlePopState = () => {
    router.path = window.location.pathname;
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}
