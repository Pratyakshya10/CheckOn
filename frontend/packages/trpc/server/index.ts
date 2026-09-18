import type { Context } from "./context";
import { authRouter } from "./routes/auth/route";
import { healthRouter } from "./routes/health/route";
import { watchesRouter } from "./routes/watches/route";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  watches: watchesRouter,
});

export type AppRouter = typeof appRouter;
export type { Context };
export type { AuthUser } from "./auth/types";
export { decodeSession, encodeSession, SESSION_COOKIE } from "./auth/session";
export { authStore } from "./auth/store";
