import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export default function SignUp() {
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ business_name: "", contact_person: "", email: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim()) return toast.error("Enter your business name");
    if (!form.contact_person.trim()) return toast.error("Enter a contact person");
    if (!/^[6-9]\d{9}$/.test(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { data } = await api.post("/customer/auth/signup", {
        business_name: form.business_name.trim(),
        contact_person: form.contact_person.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        password: form.password,
      });
      localStorage.setItem("ayurita_customer_token", data.token);
      localStorage.setItem("ayurita_customer_business_name", data.business_name);
      localStorage.setItem("ayurita_customer_email", data.email);
      toast.success(`Welcome, ${data.business_name}!`);
      nav(loc.state?.from?.pathname || "/account", { replace: true, state: loc.state?.from?.state });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12 md:py-16">
      <div className="container-x max-w-md">
        <form onSubmit={submit} className="card-premium p-6 md:p-8 space-y-5" autoComplete="off" data-testid="signup-form">
          <div className="h-12 w-12 rounded-full bg-brand-primary/10 grid place-items-center mx-auto">
            <UserPlus className="h-6 w-6 text-brand-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-heading font-bold text-xl">Create your account</h1>
            <p className="text-sm text-slate-500 mt-1">Sign up to place an order and track your purchase history.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500">Business Name</Label>
              <Input required autoComplete="organization" value={form.business_name} onChange={(e) => upd("business_name", e.target.value)} data-testid="signup-business-name-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Contact Person</Label>
              <Input required autoComplete="name" value={form.contact_person} onChange={(e) => upd("contact_person", e.target.value)} data-testid="signup-contact-person-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Email</Label>
              <Input required type="email" autoComplete="off" value={form.email} onChange={(e) => upd("email", e.target.value)} data-testid="signup-email-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Phone Number</Label>
              <Input required inputMode="numeric" maxLength={10} autoComplete="off" value={form.phone} onChange={(e) => upd("phone", e.target.value.replace(/[^0-9]/g, ""))} data-testid="signup-phone-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Password</Label>
              <PasswordInput required autoComplete="new-password" value={form.password} onChange={(e) => upd("password", e.target.value)} data-testid="signup-password-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Confirm Password</Label>
              <PasswordInput required autoComplete="new-password" value={form.confirm} onChange={(e) => upd("confirm", e.target.value)} data-testid="signup-confirm-input" />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading} data-testid="signup-submit">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </div>
          <p className="text-sm text-center text-slate-500">
            Already have an account?{" "}
            <Link to="/signin" state={loc.state} className="text-brand-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
