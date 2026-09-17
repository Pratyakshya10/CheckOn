import type { CookieOptions, Request, Response } from "express";
import {
  type AuthUser,
  decodeSession,
  encodeSession,
  SESSION_COOKIE,
} from "@checkon/trpc/server";

import { env } from "../env";

function cookieOptions(persist: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: persist ? 30 * 24 * 60 * 60 * 1000 : undefined,
  };
}

export function readSession(req: Request): AuthUser | null {
  const token = req.cookies?.[SESSION_COOKIE];
  return decodeSession(typeof token === "string" ? token : undefined, env.SESSION_SECRET);
}

export function setSession(res: Response, user: AuthUser, persist: boolean) {
  res.cookie(SESSION_COOKIE, encodeSession(user, env.SESSION_SECRET), cookieOptions(persist));
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
