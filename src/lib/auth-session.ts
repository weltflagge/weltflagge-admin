import crypto from "node:crypto";

export const AUTH_COOKIE_NAME = "weltflagge_admin_session";
export const AUTH_TTL_SECONDS = 60 * 60 * 12;

type AuthConfig = {
  username: string;
  password?: string;
  passwordSha256?: string;
  secret: string;
};

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hmac(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function getAuthConfig(): AuthConfig | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const passwordSha256 = process.env.ADMIN_PASSWORD_SHA256?.trim();
  const secret = process.env.AUTH_SECRET?.trim();

  if (!username || (!password && !passwordSha256) || !secret) {
    return null;
  }

  return {
    username,
    password,
    passwordSha256,
    secret,
  };
}

export function isAuthConfigured() {
  return Boolean(getAuthConfig());
}

export function verifyCredentials(username: string, password: string) {
  const config = getAuthConfig();

  if (!config || !safeEqual(username, config.username)) {
    return false;
  }

  if (config.passwordSha256) {
    return safeEqual(sha256(password), config.passwordSha256);
  }

  return Boolean(config.password && safeEqual(password, config.password));
}

export function createSessionToken(username: string) {
  const config = getAuthConfig();

  if (!config) {
    throw new Error("Authentication is not configured.");
  }

  const payload: SessionPayload = {
    username,
    expiresAt: Date.now() + AUTH_TTL_SECONDS * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = hmac(encodedPayload, config.secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined) {
  const config = getAuthConfig();

  if (!config || !token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = hmac(encodedPayload, config.secret);

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    return payload.username === config.username && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function sanitizeReturnPath(value: FormDataEntryValue | string | null | undefined) {
  const fallback = "/";

  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.startsWith("/login") || value.startsWith("/logout")) {
    return fallback;
  }

  return value;
}
