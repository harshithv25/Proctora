import { doubleCsrf } from "csrf-csrf";
import { env } from "../config/env";

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies?.sessionId || req.ip || "proctora_session",
  cookieName: "__csrf",
  cookieOptions: {
    httpOnly: false,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  },
  getCsrfTokenFromRequest: (req) =>
    (req.headers["x-csrf-token"] as string) ?? "",
  skipCsrfProtection: (req) => {
    const path = req.originalUrl || req.url || "";
    if (
      path.includes("/auth/login") ||
      path.includes("/auth/register") ||
      path.includes("/auth/refresh") ||
      path.includes("/csrf-token") ||
      path.includes("/health")
    ) {
      return true;
    }
    return false;
  },
});

export { doubleCsrfProtection, generateCsrfToken as generateToken };
