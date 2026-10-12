import { doubleCsrf } from "csrf-csrf";
import { env } from "../config/env";

const isProduction = env.NODE_ENV === "production";

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: () => "proctora_session",
  cookieName: "__csrf",
  cookieOptions: {
    httpOnly: false,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
  },
  getCsrfTokenFromRequest: (req) =>
    (req.headers["x-csrf-token"] as string) ?? "",
  skipCsrfProtection: (req) => {
    const path = req.originalUrl || req.url || "";
    if (
      path.includes("/csrf-token") ||
      path.includes("/health") ||
      path.includes("/healthz") ||
      path.includes("/auth/")
    ) {
      return true;
    }
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return true;
    }
    return false;
  },
});

export { doubleCsrfProtection, generateCsrfToken as generateToken };
