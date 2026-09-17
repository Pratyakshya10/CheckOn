import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { decodeSession, SESSION_COOKIE, type AuthUser } from "./session";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "";

/** HTTP API (payload format 2.0) splits the Cookie header into event.cookies. */
export function getAuthUser(event: APIGatewayProxyEventV2): AuthUser | null {
  const raw = event.cookies?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) return null;

  const token = raw.slice(SESSION_COOKIE.length + 1);
  return decodeSession(token, SESSION_SECRET);
}
