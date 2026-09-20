import type { CookieOptions, Request, Response } from "express";
import {
  type AuthUser,
  decodeSession,
  encodeSession,
  SESSION_COOKIE,
} from "@checkon/trpc/server";

import { env } from "../env";

function cookieOptions(persist: boolean): CookieOptions {
  // SameSite=None requires Secure, which requires HTTPS - only turn it on when
  // CLIENT_URL is actually served over HTTPS. Same-origin HTTP deploys need
  // SameSite=Lax/Secure=false or the browser silently drops the cookie.
  const isHttps = env.CLIENT_URL.startsWith("https://");
  return {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
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
  res.clearCookie(SESSION_COOKIE, cookieOptions(false));
}
