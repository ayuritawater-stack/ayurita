import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, LockKeyhole, ShieldCheck, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminProfile() {
  const nav = useNavigate();
  const { admin, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => {
      setUser(data);
      setEmail(data.email || "");
    }).catch(() => toast.error("Unable to load profile"));
    api.get("/auth/login-history").then(({ data }) => setLoginHistory(data)).catch(() => {});
  }, []);

  const saveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await api.post("/auth/profile/email", { email });
      setUser((u) => ({ ...u, email }));
      toast.success("Email updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password.length < 6) return toast.error("New password must be at least 6 characters");
    if (pw.new_password !== pw.confirm_password) return toast.error("Passwords do not match");
    setSavingPassword(true);
    try {
      const { data } = await api.post("/auth/profile/password", pw);
      if (data?.token) localStorage.setItem("ayurita_token", data.token);
      toast.success("Password changed");
      setPw({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Change failed");
    } finally {
      setSavingPassword(false);
    }
  };

  const logoutAll = async () => {
    if (!window.confirm("Log out of all devices, including this one?")) return;
    setLoggingOut(true);
    try {
      await api.post("/auth/profile/logout-all");
      logout();
      nav("/admin/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Unable to log out");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Account</div>
        <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Admin Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account, security, and active sessions.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card-premium p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center text-white text-lg font-bold shrink-0">
                {user?.name?.[0] || admin?.name?.[0] || "A"}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{user?.name || admin?.name}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  {(user?.admin_role || admin?.admin_role || "owner") === "owner" ? "Owner" : "Staff"}
                </div>
              </div>
            </div>

            <form onSubmit={saveEmail} className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <div>
                <Label className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 rounded-xl" data-testid="profile-email-input" />
              </div>
              <button type="submit" className="btn-primary" disabled={savingEmail} data-testid="profile-save-email">
                {savingEmail ? "Saving…" : "Update Email"}
              </button>
            </form>
          </section>

          <section className="card-premium p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-5">
              <LockKeyhole className="w-4 h-4" /> Change Password
            </div>
            <form onSubmit={savePassword} className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label className="text-xs text-slate-500">Current Password</Label>
                <Input type="password" required autoComplete="off" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} className="mt-1.5 rounded-xl" data-testid="profile-current-password" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">New Password</Label>
                <Input type="password" required autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} className="mt-1.5 rounded-xl" data-testid="profile-new-password" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Confirm Password</Label>
                <Input type="password" required autoComplete="new-password" value={pw.confirm_password} onChange={(e) => setPw((p) => ({ ...p, confirm_password: e.target.value }))} className="mt-1.5 rounded-xl" data-testid="profile-confirm-password" />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <button type="submit" className="btn-primary" disabled={savingPassword} data-testid="profile-save-password">
                  {savingPassword ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </section>

          <section className="card-premium p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
              <ShieldCheck className="w-4 h-4" /> Security Actions
            </div>
            <p className="text-sm text-slate-500 mb-4">Invalidate all active admin sessions and force re-login on every device, including this one.</p>
            <div className="flex justify-end">
              <button
                onClick={logoutAll}
                disabled={loggingOut}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-60"
                data-testid="profile-logout-all"
              >
                {loggingOut ? "Logging out…" : "Log Out All Devices"}
              </button>
            </div>
          </section>
        </div>

        <section className="card-premium p-6 h-fit">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock3 className="w-4 h-4" /> Recent Logins
            </div>
            <div className="text-xs text-slate-400">Last 50</div>
          </div>
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {loginHistory.length === 0 && (
              <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">No recent login activity found.</div>
            )}
            {loginHistory.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>{item.timestamp?.slice(0, 19).replace("T", " ")}</span>
                  <span className="text-slate-400">{item.ip_address}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
