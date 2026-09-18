import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { AuthUser } from "./types";

const scrypt = promisify(scryptCallback);

type StoredUser = AuthUser & {
  passwordHash?: string;
};

const usersByEmail = new Map<string, StoredUser>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, passwordHash: string) {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    provider: user.provider,
  };
}

export const authStore = {
  async signUp(input: { fullName: string; email: string; password: string }): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    if (usersByEmail.has(email)) {
      throw Object.assign(new Error("An account with this email already exists"), { code: "CONFLICT" });
    }

    const user: StoredUser = {
      id: `usr_${randomBytes(6).toString("hex")}`,
      email,
      fullName: input.fullName.trim(),
      provider: "password",
      passwordHash: await hashPassword(input.password),
    };
    usersByEmail.set(email, user);
    return publicUser(user);
  },

  async signIn(input: { email: string; password: string }): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const user = usersByEmail.get(email);
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw Object.assign(new Error("Invalid email or password"), { code: "UNAUTHORIZED" });
    }
    return publicUser(user);
  },

  upsertGoogle(input: { email: string; fullName: string }): AuthUser {
    const email = normalizeEmail(input.email);
    const existing = usersByEmail.get(email);
    if (existing) {
      existing.fullName = input.fullName.trim() || existing.fullName;
      existing.provider = "google";
      return publicUser(existing);
    }

    const user: StoredUser = {
      id: `usr_g_${randomBytes(6).toString("hex")}`,
      email,
      fullName: input.fullName.trim() || email.split("@")[0] || "Google user",
      provider: "google",
    };
    usersByEmail.set(email, user);
    return publicUser(user);
  },

  demoUser(): AuthUser {
    const email = (process.env.DEMO_USER_EMAIL ?? "demo@checkon.app").trim().toLowerCase();
    const existing = usersByEmail.get(email);
    if (existing) return publicUser(existing);

    const user: StoredUser = {
      id: "usr_demo_101",
      email,
      fullName: process.env.DEMO_USER_NAME?.trim() || "Demo Watcher",
      provider: "demo",
    };
    usersByEmail.set(email, user);
    return publicUser(user);
  },
};
