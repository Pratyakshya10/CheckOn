import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import type { AccountSettings, AuthUser } from "./types";

const scrypt = promisify(scryptCallback);

type StoredUser = AuthUser & {
  passwordHash?: string;
  totpSecretEncrypted?: string;
  settings: AccountSettings;
  createdAt: string;
  updatedAt: string;
};

const usersByEmail = new Map<string, StoredUser>();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getUsersTable() {
  return process.env.USERS_TABLE?.trim();
}

export const defaultAccountSettings: AccountSettings = {
  emailAlerts: true,
  weeklyDigest: true,
  pushNotifications: false,
  noiseFiltering: true,
  digestFrequency: "weekly",
  digestTime: "08:00",
  includeQuietWatches: true,
};

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
    profileRole: user.profileRole,
    provider: user.provider,
    totpEnabled: user.totpEnabled,
  };
}

async function getStoredUser(email: string): Promise<StoredUser | undefined> {
  const usersTable = getUsersTable();
  if (!usersTable) return usersByEmail.get(email);
  const result = await ddb.send(new GetCommand({ TableName: usersTable, Key: { email } }));
  return result.Item as StoredUser | undefined;
}

async function saveStoredUser(user: StoredUser, onlyIfNew = false): Promise<void> {
  const usersTable = getUsersTable();
  if (!usersTable) {
    if (onlyIfNew && usersByEmail.has(user.email)) {
      throw Object.assign(new Error("An account with this email already exists"), { code: "CONFLICT" });
    }
    usersByEmail.set(user.email, user);
    return;
  }
  try {
    await ddb.send(
      new PutCommand({
        TableName: usersTable,
        Item: user,
        ...(onlyIfNew ? { ConditionExpression: "attribute_not_exists(email)" } : {}),
      }),
    );
  } catch (error) {
    if (
      onlyIfNew &&
      error instanceof Error &&
      (error.name === "ConditionalCheckFailedException" || error.name === "TransactionCanceledException")
    ) {
      throw Object.assign(new Error("An account with this email already exists"), { code: "CONFLICT" });
    }
    throw error;
  }
}

function accountSettings(user: StoredUser): AccountSettings {
  return { ...defaultAccountSettings, ...user.settings };
}

function encryptionKey() {
  const configured = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("TOTP_ENCRYPTION_KEY is required in production");
  }
  return createHash("sha256").update(configured || "checkon-local-totp-key").digest();
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Invalid encrypted TOTP secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(value: Buffer) {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(value: string) {
  let bits = "";
  for (const character of value.replace(/=+$/g, "").toUpperCase()) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30_000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret: string, code: string) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(totpCode(secret, Date.now() + window * 30_000));
    const actual = Buffer.from(normalized);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
}

export const authStore = {
  async signUp(input: { fullName: string; email: string; password: string }): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: `usr_${randomBytes(6).toString("hex")}`,
      email,
      fullName: input.fullName.trim(),
      provider: "password",
      passwordHash: await hashPassword(input.password),
      totpEnabled: false,
      settings: { ...defaultAccountSettings },
      createdAt: now,
      updatedAt: now,
    };
    await saveStoredUser(user, true);
    return publicUser(user);
  },

  async signIn(input: { email: string; password: string; totpCode?: string }): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const user = await getStoredUser(email);
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw Object.assign(new Error("Invalid email or password"), { code: "UNAUTHORIZED" });
    }
    if (user.totpEnabled) {
      if (!input.totpCode) {
        throw Object.assign(new Error("Enter the 6-digit code from your authenticator app"), {
          code: "TOTP_REQUIRED",
        });
      }
      if (!user.totpSecretEncrypted || !verifyTotp(decryptSecret(user.totpSecretEncrypted), input.totpCode)) {
        throw Object.assign(new Error("Invalid or expired authenticator code"), { code: "UNAUTHORIZED" });
      }
    }
    return publicUser(user);
  },

  async upsertGoogle(input: { email: string; fullName: string }): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const existing = await getStoredUser(email);
    if (existing) {
      existing.fullName = input.fullName.trim() || existing.fullName;
      existing.updatedAt = new Date().toISOString();
      await saveStoredUser(existing);
      return publicUser(existing);
    }

    const now = new Date().toISOString();
    const user: StoredUser = {
      id: `usr_g_${randomBytes(6).toString("hex")}`,
      email,
      fullName: input.fullName.trim() || email.split("@")[0] || "Google user",
      provider: "google",
      totpEnabled: false,
      settings: { ...defaultAccountSettings },
      createdAt: now,
      updatedAt: now,
    };
    await saveStoredUser(user, true);
    return publicUser(user);
  },

  async demoUser(): Promise<AuthUser> {
    const email = (process.env.DEMO_USER_EMAIL ?? "demo@checkon.app").trim().toLowerCase();
    const existing = await getStoredUser(email);
    if (existing) return publicUser(existing);

    const now = new Date().toISOString();
    const user: StoredUser = {
      id: "usr_demo_101",
      email,
      fullName: process.env.DEMO_USER_NAME?.trim() || "Demo Watcher",
      provider: "demo",
      totpEnabled: false,
      settings: { ...defaultAccountSettings },
      createdAt: now,
      updatedAt: now,
    };
    await saveStoredUser(user, true);
    return publicUser(user);
  },

  async updateProfile(emailInput: string, fullName: string, profileRole?: string): Promise<AuthUser> {
    const email = normalizeEmail(emailInput);
    const user = await getStoredUser(email);
    if (!user) throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND" });
    user.fullName = fullName.trim();
    user.profileRole = profileRole?.trim() || undefined;
    user.updatedAt = new Date().toISOString();
    await saveStoredUser(user);
    return publicUser(user);
  },

  async changePassword(emailInput: string, currentPassword: string, nextPassword: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await getStoredUser(email);
    if (!user?.passwordHash || user.provider !== "password") {
      throw Object.assign(new Error("Password changes are only available for password accounts"), {
        code: "BAD_REQUEST",
      });
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw Object.assign(new Error("Current password is incorrect"), { code: "UNAUTHORIZED" });
    }
    user.passwordHash = await hashPassword(nextPassword);
    user.updatedAt = new Date().toISOString();
    await saveStoredUser(user);
  },

  async getSettings(emailInput: string): Promise<AccountSettings> {
    const user = await getStoredUser(normalizeEmail(emailInput));
    if (!user) throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND" });
    return accountSettings(user);
  },

  async updateSettings(emailInput: string, settings: Partial<AccountSettings>): Promise<AccountSettings> {
    const email = normalizeEmail(emailInput);
    const user = await getStoredUser(email);
    if (!user) throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND" });
    user.settings = { ...accountSettings(user), ...settings };
    user.updatedAt = new Date().toISOString();
    await saveStoredUser(user);
    return user.settings;
  },

  async beginTotp(emailInput: string): Promise<{ secret: string; otpauthUri: string }> {
    const email = normalizeEmail(emailInput);
    const user = await getStoredUser(email);
    if (!user || user.provider !== "password") {
      throw Object.assign(new Error("Authenticator 2FA is available for password accounts"), {
        code: "BAD_REQUEST",
      });
    }
    if (user.totpEnabled) {
      throw Object.assign(new Error("Authenticator 2FA is already enabled"), { code: "BAD_REQUEST" });
    }
    const secret = encodeBase32(randomBytes(20));
    user.totpSecretEncrypted = encryptSecret(secret);
    user.totpEnabled = false;
    user.updatedAt = new Date().toISOString();
    await saveStoredUser(user);
    const label = encodeURIComponent(`CheckOn:${email}`);
    const issuer = encodeURIComponent("CheckOn");
    return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}` };
  },

  async enableTotp(emailInput: string, code: string): Promise<AuthUser> {
    const email = normalizeEmail(emailInput);
    const user = await getStoredUser(email);
    if (!user?.totpSecretEncrypted) {
      throw Object.assign(new Error("Start authenticator setup first"), { code: "BAD_REQUEST" });
    }
    if (!verifyTotp(decryptSecret(user.totpSecretEncrypted), code)) {
      throw Object.assign(new Error("Invalid or expired authenticator code"), { code: "UNAUTHORIZED" });
    }
    user.totpEnabled = true;
    user.updatedAt = new Date().toISOString();
    await saveStoredUser(user);
    return publicUser(user);
  },

  async disableTotp(emailInput: string, code: string): Promise<AuthUser> {
    const email = normalizeEmail(emailInput);
    const user = await getStoredUser(email);
    if (!user?.totpEnabled || !user.totpSecretEncrypted) {
      throw Object.assign(new Error("Authenticator 2FA is not enabled"), { code: "BAD_REQUEST" });
    }
    if (!verifyTotp(decryptSecret(user.totpSecretEncrypted), code)) {
      throw Object.assign(new Error("Invalid or expired authenticator code"), { code: "UNAUTHORIZED" });
    }
    user.totpEnabled = false;
    delete user.totpSecretEncrypted;
    user.updatedAt = new Date().toISOString();
    await saveStoredUser(user);
    return publicUser(user);
  },
};
