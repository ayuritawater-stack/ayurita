import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { useWishlist } from "@/lib/wishlist";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const nav = useNavigate();
  const { syncAfterLogin } = useWishlist();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter your email address");
    setLoading(true);
    try {
      await api.post("/customer/auth/forgot-password", { email: email.trim().toLowerCase() });
      toast.success("If an account exists for this email, a reset code has been sent via WhatsApp.");
      setStep("reset");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) return toast.error("Enter the 6-digit code sent via WhatsApp");
    if (newPassword.length < 6) return toast.error("New password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { data } = await api.post("/customer/auth/reset-password", {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        new_password: newPassword,
      });
      localStorage.setItem("ayurita_customer_token", data.token);
      localStorage.setItem("ayurita_customer_business_name", data.business_name);
      localStorage.setItem("ayurita_customer_email", data.email);
      syncAfterLogin();
      toast.success("Password reset successfully!");
      nav("/account", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid or expired reset code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12 md:py-16">
      <div className="container-x max-w-md">
        <div className="card-premium p-6 md:p-8 space-y-5">
          <div className="h-12 w-12 rounded-full bg-brand-primary/10 grid place-items-center mx-auto">
            <KeyRound className="h-6 w-6 text-brand-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-heading font-bold text-xl">Reset password</h1>
          </div>

          {step === "request" ? (
            <form onSubmit={requestCode} autoComplete="off" data-testid="forgot-password-form">
              <p className="text-sm text-slate-500 text-center">Enter your account email and we'll send a reset code to your registered WhatsApp number.</p>
              <div className="mt-5 space-y-3">
                <div>
                  <Label className="text-xs text-slate-500">Email</Label>
                  <Input required type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-password-email-input" />
                </div>
                <button type="submit" className="btn-primary w-full justify-center" disabled={loading} data-testid="forgot-password-submit">
                  {loading ? "Sending..." : "Send reset code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={resetPassword} autoComplete="off" data-testid="reset-password-form">
              <p className="text-sm text-slate-500 text-center">Enter the 6-digit code sent to your WhatsApp, then choose a new password.</p>
              <div className="mt-5 space-y-3">
                <div>
                  <Label className="text-xs text-slate-500">Reset code</Label>
                  <Input required inputMode="numeric" maxLength={6} autoComplete="off" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} data-testid="reset-password-otp-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">New password</Label>
                  <PasswordInput required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="reset-password-new-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Confirm new password</Label>
                  <PasswordInput required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} data-testid="reset-password-confirm-input" />
                </div>
                <button type="submit" className="btn-primary w-full justify-center" disabled={loading} data-testid="reset-password-submit">
                  {loading ? "Resetting..." : "Reset password"}
                </button>
                <button type="button" className="text-xs text-brand-primary hover:underline w-full text-center" onClick={requestCode} disabled={loading}>
                  Resend code
                </button>
              </div>
            </form>
          )}

          <p className="text-sm text-center text-slate-500">
            Remembered your password?{" "}
            <Link to="/signin" className="text-brand-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
