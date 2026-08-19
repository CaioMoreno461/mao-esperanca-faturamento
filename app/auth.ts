import { headers } from "next/headers";
import { getFinanceDb } from "@/db/runtime";

const COOKIE_NAME = "mao_esperanca_session";
const SESSION_HOURS = 8;
const PASSWORD_ITERATIONS = 210_000;

type AuthRow = {
  username: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  session_version: number;
};

export type AuthUser = {
  username: string;
};

export async function authenticate(
  username: string,
  password: string,
): Promise<{ user: AuthUser; sessionVersion: number } | null> {
  const row = await getCredentials();
  if (!row || username !== row.username) {
    await consumePasswordWork(password);
    return null;
  }

  const actual = await derivePasswordHash(
    password,
    row.password_salt,
    row.password_iterations,
  );
  if (!timingSafeEqual(actual, row.password_hash)) return null;

  return {
    user: { username: row.username },
    sessionVersion: row.session_version,
  };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  const cookie = readCookie(requestHeaders.get("cookie"), COOKIE_NAME);
  if (!cookie) return null;

  const session = await verifySession(cookie);
  if (!session) return null;

  const db = await getFinanceDb();
  await ensureAuthSchema(db);
  const row = await db
    .prepare(
      "SELECT username, session_version FROM auth_credentials WHERE id = 1",
    )
    .first<{ username: string; session_version: number }>();

  if (
    !row ||
    row.username !== session.username ||
    row.session_version !== session.version
  ) {
    return null;
  }

  return { username: row.username };
}

export async function createSessionToken(
  username: string,
  version: number,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_HOURS * 60 * 60;
  const payload = base64UrlEncode(
    JSON.stringify({ username, version, expiresAt }),
  );
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export function sessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_HOURS * 60 * 60}`,
  ].join("; ");
}

export function expiredSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ username: string; sessionVersion: number } | null> {
  if (newPassword.length < 10 || newPassword.length > 128) {
    throw new Error("A nova senha deve ter entre 10 e 128 caracteres.");
  }

  const row = await getCredentials();
  if (!row) return null;

  const currentHash = await derivePasswordHash(
    currentPassword,
    row.password_salt,
    row.password_iterations,
  );
  if (!timingSafeEqual(currentHash, row.password_hash)) return null;

  const salt = randomToken(18);
  const passwordHash = await derivePasswordHash(
    newPassword,
    salt,
    PASSWORD_ITERATIONS,
  );
  const sessionVersion = row.session_version + 1;
  const db = await getFinanceDb();
  await db
    .prepare(
      `UPDATE auth_credentials
          SET password_hash = ?, password_salt = ?, password_iterations = ?,
              session_version = ?, updated_at = ?
        WHERE id = 1`,
    )
    .bind(
      passwordHash,
      salt,
      PASSWORD_ITERATIONS,
      sessionVersion,
      new Date().toISOString(),
    )
    .run();

  return { username: row.username, sessionVersion };
}

async function getCredentials(): Promise<AuthRow | null> {
  const db = await getFinanceDb();
  await ensureAuthSchema(db);

  let row = await db
    .prepare(
      `SELECT username, password_hash, password_salt, password_iterations,
              session_version
         FROM auth_credentials
        WHERE id = 1`,
    )
    .first<AuthRow>();

  if (row) return row;

  const username = process.env.AUTH_USERNAME?.trim();
  const initialPassword = process.env.AUTH_INITIAL_PASSWORD;
  if (!username || !initialPassword) return null;

  const salt = randomToken(18);
  const passwordHash = await derivePasswordHash(
    initialPassword,
    salt,
    PASSWORD_ITERATIONS,
  );

  await db
    .prepare(
      `INSERT OR IGNORE INTO auth_credentials
         (id, username, password_hash, password_salt, password_iterations,
          session_version, updated_at)
       VALUES (1, ?, ?, ?, ?, 1, ?)`,
    )
    .bind(
      username,
      passwordHash,
      salt,
      PASSWORD_ITERATIONS,
      new Date().toISOString(),
    )
    .run();

  row = await db
    .prepare(
      `SELECT username, password_hash, password_salt, password_iterations,
              session_version
         FROM auth_credentials
        WHERE id = 1`,
    )
    .first<AuthRow>();

  return row ?? null;
}

async function ensureAuthSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS auth_credentials (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        session_version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
}

async function verifySession(
  token: string,
): Promise<{ username: string; version: number } | null> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);
  const expectedSignature = await sign(payload);
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as {
      username?: unknown;
      version?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.username !== "string" ||
      !Number.isSafeInteger(parsed.version) ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { username: parsed.username, version: parsed.version as number };
  } catch {
    return null;
  }
}

async function derivePasswordHash(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations,
    },
    material,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

async function consumePasswordWork(password: string) {
  await derivePasswordHash(password, "invalid-credential-work", PASSWORD_ITERATIONS);
}

async function sign(value: string): Promise<string> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("A autenticação ainda não foi configurada.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^
      (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

function randomToken(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function base64UrlEncode(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
