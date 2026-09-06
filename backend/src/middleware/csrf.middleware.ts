import { doubleCsrf } from "csrf-csrf";
import { env } from "../config/env";

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.ip || "anonymous",
  cookieName: "__csrf",
  cookieOptions: {
    httpOnly: false,
    sameSite: "strict",
    secure: env.NODE_ENV === "production",
    path: "/",
  },
  getCsrfTokenFromRequest: (req) =>
    (req.headers["x-csrf-token"] as string) ?? "",
});

export { doubleCsrfProtection, generateCsrfToken as generateToken };
