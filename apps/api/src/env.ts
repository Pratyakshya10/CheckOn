import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

loadEnv({ path: path.join(repoRoot, ".env") });

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(16).default("checkon-dev-session-secret"),
  DEMO_LOGIN_ENABLED: z.enum(["true", "false"]).default("true"),
  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_NAME: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:5173/auth/google/callback"),
});

const parsed = envSchema.safeParse({
  NODE_ENV: emptyToUndefined(process.env.NODE_ENV),
  PORT: emptyToUndefined(process.env.PORT),
  CLIENT_URL: emptyToUndefined(process.env.CLIENT_URL),
  SESSION_SECRET: emptyToUndefined(process.env.SESSION_SECRET),
  DEMO_LOGIN_ENABLED: emptyToUndefined(process.env.DEMO_LOGIN_ENABLED),
  DEMO_USER_EMAIL: emptyToUndefined(process.env.DEMO_USER_EMAIL),
  DEMO_USER_NAME: emptyToUndefined(process.env.DEMO_USER_NAME),
  GOOGLE_OAUTH_CLIENT_ID: emptyToUndefined(process.env.GOOGLE_OAUTH_CLIENT_ID),
  GOOGLE_OAUTH_CLIENT_SECRET: emptyToUndefined(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
  GOOGLE_OAUTH_REDIRECT_URI: emptyToUndefined(process.env.GOOGLE_OAUTH_REDIRECT_URI),
});

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = parsed.data;
