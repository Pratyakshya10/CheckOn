import type { Context } from "./context";
import { accountRouter } from "./routes/account/route";
import { authRouter } from "./routes/auth/route";
import { healthRouter } from "./routes/health/route";
import { watchesRouter } from "./routes/watches/route";
import { router } from "./trpc";

export const appRouter = router({
  account: accountRouter,
  health: healthRouter,
  auth: authRouter,
  watches: watchesRouter,
});

export type AppRouter = typeof appRouter;
export type { Context };
export type { AccountSettings, AuthUser } from "./auth/types";
export { decodeSession, encodeSession, SESSION_COOKIE } from "./auth/session";
export { authStore } from "./auth/store";
