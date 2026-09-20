import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "@checkon/trpc/server";

import { env } from "./env";
import { backendProxyRouter } from "./routes/backend-proxy";
import { googleAuthRouter } from "./routes/google-auth";
import { clearSession, readSession, setSession } from "./services/session";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.use("/auth", googleAuthRouter);
app.use("/backend", backendProxyRouter);

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => {
      const headerId = req.headers["x-request-id"];
      const requestId =
        (typeof headerId === "string" && headerId.trim()) || crypto.randomUUID().slice(0, 12);
      res.setHeader("x-request-id", requestId);

      const user = readSession(req) ?? undefined;
      return {
        requestId,
        user,
        userId: user?.id,
        setSession: (nextUser, persist) => setSession(res, nextUser, persist),
        clearSession: () => clearSession(res),
      };
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "checkon-api" });
});

app.listen(env.PORT, () => {
  console.log(`CheckOn API listening on http://localhost:${env.PORT}`);
});
