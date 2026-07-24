import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import compression from "compression";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// Clerk proxy — must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Rate limiting — 300 req/min per IP on API; stricter on auth
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts, try again later" },
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

app.use(compression());

// CORS — allow production domains + localhost dev
// In production set ALLOWED_ORIGINS=https://geem.pk,https://crm.geem.pk,https://sim.geem.pk
const rawAllowed = process.env.ALLOWED_ORIGINS || "";
const productionOrigins = rawAllowed
  ? rawAllowed.split(",").map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = new Set<string>([
  ...productionOrigins,
  ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
  ...(process.env.REPLIT_DOMAINS?.split(",").map(d => `https://${d.trim()}`) ?? []),
  "http://localhost:3000",
  "http://localhost:5173",
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) cb(null, true);
    else cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Session-Key"],
  maxAge: 86400,
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Clerk middleware — resolves publishable key per-host for custom domains
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Apply rate limiters
app.use("/api/auth/login", authLimiter);
app.use("/api", apiLimiter);
app.use("/api", router);

export default app;
