import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl } from "@/lib/auth";
import { toast } from "sonner";

const API_BASE_URL = getApiBaseUrl();

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("send");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function submit(endpoint, payload) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data?.error || "Request failed");
      error.retryAfterSec = data?.retryAfterSec || 0;
      throw error;
    }
    return data;
  }

  async function handleSendOtp(event) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const data = await submit("/api/auth/forgot-password/send-otp", { email });
      toast.success(data?.message || "OTP sent successfully");
      setResendCooldown(30);
      setStep("verify");
    } catch (submitError) {
      if (submitError?.retryAfterSec) {
        setResendCooldown(submitError.retryAfterSec);
      }
      toast.error(submitError.message || "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (!email || resendCooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    setStep("send");

    try {
      const data = await submit("/api/auth/forgot-password/send-otp", { email });
      toast.success(data?.message || "OTP sent successfully");
      setResendCooldown(30);
      setStep("verify");
    } catch (submitError) {
      if (submitError?.retryAfterSec) {
        setResendCooldown(submitError.retryAfterSec);
      }
      toast.error(submitError.message || "Failed to resend OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const data = await submit("/api/auth/forgot-password/verify-otp", { email, otp });
      toast.success(data?.message || "OTP verified successfully");
      setStep("reset");
    } catch (submitError) {
      toast.error(submitError.message || "Invalid OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const data = await submit("/api/auth/forgot-password/reset", { email, otp, newPassword });
      toast.success(data?.message || "Password reset successful");
      setTimeout(() => navigate("/login", { replace: true }), 1000);
    } catch (submitError) {
      toast.error(submitError.message || "Password reset failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <Link to="/login" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Sign In</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h1>
            <p className="text-gray-600 text-sm">
              {step === "send" && "Enter your email to receive OTP."}
              {step === "verify" && "Enter the OTP sent to your email."}
              {step === "reset" && "Set your new password."}
            </p>
          </div>

          {step === "send" && (
            <form className="space-y-6" onSubmit={handleSendOtp}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="h-11 text-sm"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base rounded-lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Sending OTP...
                  </span>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </form>
          )}

          {step === "verify" && (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-sm font-medium text-gray-700">
                  OTP
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  required
                  className="h-11 text-sm"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base rounded-lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Verifying OTP...
                  </span>
                ) : (
                  "Verify OTP"
                )}
              </Button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isSubmitting || resendCooldown > 0}
                className="w-full text-sm text-blue-600 cursor-pointer hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Send OTP Again"}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                  New Password (minimum 8 characters)
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    required
                    className="h-11 text-sm pr-10"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Resetting password...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
