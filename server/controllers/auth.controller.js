import crypto from "node:crypto";
import { User } from "../models/user.model.js";
import {
  createAuthToken,
  generateOtp,
  hashOtp,
  hashPassword,
  verifyLegacyPassword,
  verifyOtp,
  verifyPassword,
} from "../utils/auth.js";
import { sendOtpEmail } from "../utils/mailer.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const inMemoryUsers = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
  };
}

function isDbReady() {
  return User.db?.readyState === 1;
}

async function findUserByEmail(email) {
  if (isDbReady()) {
    return User.findOne({ email });
  }
  return inMemoryUsers.get(email) ?? null;
}

async function findUserById(id) {
  if (!id) return null;

  if (isDbReady()) {
    return User.findById(id);
  }

  for (const user of inMemoryUsers.values()) {
    if (String(user.id) === String(id)) {
      return user;
    }
  }
  return null;
}

async function createUser({ name, email, passwordHash }) {
  if (isDbReady()) {
    return User.create({ name, email, passwordHash });
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    passwordSalt: null,
    resetOtpHash: null,
    resetOtpExpiresAt: null,
    resetOtpVerified: false,
    resetOtpLastSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryUsers.set(email, user);
  return user;
}

async function persistUser(user) {
  if (isDbReady()) {
    await user.save();
    return;
  }
  user.updatedAt = new Date();
  inMemoryUsers.set(user.email, user);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function makeAuthResponse(user) {
  const safeUser = sanitizeUser(user);
  const token = createAuthToken({
    sub: safeUser.id,
    email: safeUser.email,
    name: safeUser.name,
  });
  return { token, user: safeUser };
}

export async function signup(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || !email || !validatePassword(password)) {
      return res.status(400).json({ error: "Name, email and password (min 8 chars) are required" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ name, email, passwordHash });
    return res.status(201).json(makeAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ error: "Signup failed", details: error.message });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword && user.passwordSalt) {
      isValidPassword = verifyLegacyPassword(password, user.passwordSalt, user.passwordHash);
      if (isValidPassword) {
        user.passwordHash = await hashPassword(password);
        user.passwordSalt = null;
        await persistUser(user);
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json(makeAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ error: "Login failed", details: error.message });
  }
}

export async function me(req, res) {
  try {
    const user = await findUserById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user", details: error.message });
  }
}

export async function sendForgotPasswordOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(200).json({ message: "If the account exists, OTP has been sent" });
    }

    const lastSentMs = user.resetOtpLastSentAt ? new Date(user.resetOtpLastSentAt).getTime() : 0;
    const remainingMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSentMs);
    if (remainingMs > 0) {
      return res.status(429).json({
        error: "Please wait before requesting another OTP",
        retryAfterSec: Math.ceil(remainingMs / 1000),
      });
    }

    const otp = generateOtp();
    user.resetOtpHash = await hashOtp(otp);
    user.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.resetOtpVerified = false;
    user.resetOtpLastSentAt = new Date();
    await persistUser(user);
    await sendOtpEmail({ to: email, otp });

    return res.json({ message: "If the account exists, OTP has been sent" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to send OTP", details: error.message });
  }
}

export async function verifyForgotPasswordOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ error: "Invalid OTP request" });
    }

    const isExpired = new Date(user.resetOtpExpiresAt).getTime() < Date.now();
    const isMatch = await verifyOtp(otp, user.resetOtpHash);
    if (isExpired || !isMatch) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    user.resetOtpVerified = true;
    await persistUser(user);
    return res.json({ message: "OTP verified" });
  } catch (error) {
    return res.status(500).json({ error: "OTP verification failed", details: error.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!email || !otp || !validatePassword(newPassword)) {
      return res.status(400).json({ error: "Email, OTP and new password (min 8 chars) are required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ error: "Invalid reset request" });
    }

    const isExpired = new Date(user.resetOtpExpiresAt).getTime() < Date.now();
    const isMatch = await verifyOtp(otp, user.resetOtpHash);
    if (isExpired || !isMatch || !user.resetOtpVerified) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    user.passwordSalt = null;
    user.passwordHash = await hashPassword(newPassword);
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    user.resetOtpVerified = false;
    user.resetOtpLastSentAt = null;
    await persistUser(user);

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reset password", details: error.message });
  }
}
