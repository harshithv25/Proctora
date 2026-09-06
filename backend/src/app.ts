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

app.use(helmet());

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(globalLimiter);
app.use(doubleCsrfProtection);

app.use("/api", apiRouter);

app.use((_req, _res, next) => {
  next(new NotFoundError("The requested resource was not found"));
});

app.use(errorHandler);

export default app;
