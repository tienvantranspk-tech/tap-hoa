import express from "express";
import cors from "cors";
import morgan from "morgan";
import { router } from "./routes";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";

export const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((item) => item.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "dong-gia-backend" });
});

app.use("/api", router);
app.use(notFound);
app.use(errorHandler);
