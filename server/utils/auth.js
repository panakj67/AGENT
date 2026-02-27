import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const BCRYPT_ROUNDS = 10;

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[auth] AUTH_TOKEN_SECRET not set. Using development fallback secret.");
    return "dev-only-fallback-secret-change-me";
  }

  throw new Error("AUTH_TOKEN_SECRET is not configured");
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, expectedHash) {
  if (!expectedHash) return false;
  return bcrypt.compare(password, expectedHash);
}

export function verifyLegacyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const computedHash = hashLegacyScrypt(password, salt);
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashLegacyScrypt(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function createAuthToken(payload) {
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    },
    getSecret(),
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token format");
  }

  return jwt.verify(token, getSecret());
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function hashOtp(otp) {
  return bcrypt.hash(String(otp), BCRYPT_ROUNDS);
}

export async function verifyOtp(otp, otpHash) {
  if (!otpHash) return false;
  return bcrypt.compare(String(otp), otpHash);
}
