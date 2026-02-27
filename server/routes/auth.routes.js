import { Router } from "express";
import {
  login,
  me,
  resetPassword,
  sendForgotPasswordOtp,
  signup,
  verifyForgotPasswordOtp,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot-password/reset", resetPassword);

export default router;
