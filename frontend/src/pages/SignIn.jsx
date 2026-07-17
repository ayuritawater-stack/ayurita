import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { LockKeyhole } from "lucide-react";
import { api } from "@/lib/api";
import { useWishlist } from "@/lib/wishlist";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export default function SignIn() {
  const nav = useNavigate();
  const loc = useLocation();
  const { syncAfterLogin } = useWishlist();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) return toast.error("Enter your email and password");
    setLoading(true);
    try {
      const { data } = await api.post("/customer/auth/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      localStorage.setItem("ayurita_customer_token", data.token);
      localStorage.setItem("ayurita_customer_business_name", data.business_name);
      localStorage.setItem("ayurita_customer_email", data.email);
      syncAfterLogin();
      toast.success(`Welcome back, ${data.business_name}!`);
      nav(loc.state?.from?.pathname || "/account", { replace: true, state: loc.state?.from?.state });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12 md:py-16">
      <div className="container-x max-w-md">
        <form onSubmit={submit} className="card-premium p-6 md:p-8 space-y-5" autoComplete="off" data-testid="signin-form">
          <div className="h-12 w-12 rounded-full bg-brand-primary/10 grid place-items-center mx-auto">
            <LockKeyhole className="h-6 w-6 text-brand-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-heading font-bold text-xl">Sign in</h1>
            <p className="text-sm text-slate-500 mt-1">Log in to continue to checkout and view your orders.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500">Email</Label>
              <Input required type="email" autoComplete="off" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} data-testid="signin-email-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Password</Label>
              <PasswordInput required autoComplete="off" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} data-testid="signin-password-input" />
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-brand-primary hover:underline" data-testid="signin-forgot-password-link">Forgot password?</Link>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading} data-testid="signin-submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
          <p className="text-sm text-center text-slate-500">
            Don't have an account?{" "}
            <Link to="/signup" state={loc.state} className="text-brand-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
