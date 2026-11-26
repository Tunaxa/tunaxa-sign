import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { errorHandler, notFoundHandler } from "./middleware/error";
import { rateLimitHandler } from "./middleware/rate-limit";
import { requestId } from "./middleware/request-id";
import { routes } from "./routes";

export const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
app.set("trust proxy", Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

// ─── Global Middleware ────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.WEB_URL || "http://localhost:5173",
    process.env.SIGNING_URL || "http://localhost:5174",
    process.env.ADMIN_URL || "http://localhost:5175",
  ],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));
app.use(requestId);

// ─── Rate Limiting ────────────────────────────────────
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      req.path.startsWith("/v1/signing") || req.path === "/v1/auth/login",
    handler: rateLimitHandler,
  })
);

// ─── Health Check ─────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────
app.use("/api/v1", routes);

// ─── Error Handling ───────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);
