import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthUser } from "./types";

export type { AuthUser } from "./types";

export const SESSION_COOKIE = "checkon_session";

export function encodeSession(user: AuthUser, secret: string) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeSession(token: string | undefined, secret: string): AuthUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser;
  } catch {
    return null;
  }
}
