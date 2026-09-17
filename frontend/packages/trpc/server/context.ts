import type { AuthUser } from "./auth/session";

export type Context = {
  requestId: string;
  userId?: string;
  user?: AuthUser;
  setSession: (user: AuthUser, persist: boolean) => void;
  clearSession: () => void;
};
