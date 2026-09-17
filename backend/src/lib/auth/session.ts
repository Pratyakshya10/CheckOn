import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ported from packages/trpc/server/auth/session.ts (apps/web + apps/api) —
 * same algorithm, same cookie name, same secret. Google sign-in already
 * exists end-to-end on that side (apps/api/src/routes/google-auth.ts); this
 * backend verifies the cookie it issues rather than running a second,
 * competing auth system (Cognito) that the frontend never talks to.
 *
 * SESSION_SECRET must be the exact same value configured for apps/api.
 */
export const SESSION_COOKIE = "checkon_session";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  provider: "password" | "google" | "demo";
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
