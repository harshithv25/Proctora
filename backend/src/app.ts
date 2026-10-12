import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { globalLimiter } from "./middleware/rateLimit.middleware";
import { doubleCsrfProtection } from "./middleware/csrf.middleware";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { NotFoundError } from "./lib/apiError";
import apiRouter from "./routes/index";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === env.CLIENT_URL || env.CLIENT_URL === "*") return callback(null, true);
      if (
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Unrestricted health check routes for cloud load balancers and Render health checks
app.all(["/healthz", "/health", "/"], (_req, res) => {
  res.status(200).json({
    status: "healthy",
    message: "Proctora API is live",
    timestamp: new Date().toISOString(),
  });
});

app.use(globalLimiter);
app.use(doubleCsrfProtection);

app.use("/api", apiRouter);

app.use((_req, _res, next) => {
  next(new NotFoundError("The requested resource was not found"));
});

app.use(errorHandler);

export default app;
