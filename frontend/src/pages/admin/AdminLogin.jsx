import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Droplets, ArrowRight, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
  const nav = useNavigate();
  const { login, admin } = useAuth();
  const [form, setForm] = useState({ email: "admin@ayurita.com", password: "Ayurita@2026" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (admin) nav("/admin");
  }, [admin, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      nav("/admin");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-900">
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-[#0F4C81] to-[#0B3A66]" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, rgba(56,189,248,0.6), transparent 40%), radial-gradient(circle at 70% 80%, rgba(16,185,129,0.5), transparent 40%)"
        }} />
        <div className="relative z-10 p-12 flex flex-col justify-between text-white w-full">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <div className="font-heading font-bold text-lg">Ayurita</div>
              <div className="text-[10px] uppercase tracking-widest text-white/70 -mt-0.5">Admin Console</div>
            </div>
          </Link>
          <div className="max-w-md">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary mb-3">Business Command Center</div>
            <div className="font-heading font-bold text-3xl md:text-4xl leading-tight tracking-tight">
              Manage products, orders and bulk inquiries — all in one premium dashboard.
            </div>
            <div className="mt-8 text-white/70 text-sm leading-relaxed">
              Track revenue, respond to inquiries, generate GST invoices and grow your water business with confidence.
            </div>
          </div>
          <div className="text-xs text-white/50">© {new Date().getFullYear()} Ayurita Packaged Drinking Water</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-slate-50">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="admin-login-form">
          <div className="mb-8">
            <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900">Admin Login</h1>
            <p className="text-slate-500 text-sm mt-2">Sign in to manage your Ayurita business.</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="pl-10 rounded-xl h-11"
                  data-testid="login-email"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="pl-10 rounded-xl h-11"
                  data-testid="login-password"
                />
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-6 !h-11 disabled:opacity-60" data-testid="login-submit">
            {loading ? "Signing in…" : "Sign In"} <ArrowRight className="w-4 h-4" />
          </button>
          <div className="text-center mt-6">
            <Link to="/" className="text-xs text-slate-500 hover:text-brand-primary">← Back to website</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
