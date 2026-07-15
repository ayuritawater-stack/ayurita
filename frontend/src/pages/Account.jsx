import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, MapPin, Mail, LockKeyhole, LogOut, Package } from "lucide-react";
import { api, formatINR, logoutCustomer } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statusColor = {
  placed: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  confirmed: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  processing: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  packed: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  dispatched: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  delivered: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/20",
};

const emptyProfile = { business_name: "", contact_person: "", email: "", phone: "", address: "", city: "", gst_number: "" };

export default function Account() {
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyProfile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    api
      .get("/customer/profile")
      .then(({ data }) => {
        setProfile(data);
        setForm({ ...emptyProfile, ...data });
        setNewEmail(data.email || "");
      })
      .catch(() => toast.error("Unable to load profile"));
    api
      .get("/customer/orders")
      .then(({ data }) => setOrders(data))
      .finally(() => setLoadingOrders(false));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { business_name, contact_person, phone, address, city, gst_number } = form;
      const { data } = await api.put("/customer/profile", { business_name, contact_person, phone, address, city, gst_number });
      setProfile(data);
      localStorage.setItem("ayurita_customer_business_name", data.business_name);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const { data } = await api.put("/customer/profile", { email: newEmail.trim().toLowerCase() });
      setProfile(data);
      setForm((f) => ({ ...f, email: data.email }));
      localStorage.setItem("ayurita_customer_email", data.email);
      toast.success("Email updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingEmail(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password.length < 6) return toast.error("New password must be at least 6 characters");
    if (pw.new_password !== pw.confirm) return toast.error("Passwords do not match");
    setSavingPw(true);
    try {
      const { data } = await api.post("/customer/profile/password", { current_password: pw.current_password, new_password: pw.new_password });
      if (data?.token) localStorage.setItem("ayurita_customer_token", data.token);
      toast.success("Password changed");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Change failed");
    } finally {
      setSavingPw(false);
    }
  };

  const logout = () => {
    logoutCustomer();
    nav("/");
  };

  if (!profile) {
    return (
      <div className="py-12 md:py-16">
        <div className="container-x">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-16">
      <div className="container-x space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl">My Account</h1>
            <p className="text-sm text-slate-500">
              {profile.business_name} · {profile.email}
            </p>
          </div>
          <button className="btn-secondary gap-2 inline-flex items-center" onClick={logout} data-testid="account-logout">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <form onSubmit={saveProfile} className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" />
                Business Details
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-500">Business Name</Label>
                  <Input required value={form.business_name} onChange={(e) => upd("business_name", e.target.value)} data-testid="account-business-name-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Contact Person</Label>
                  <Input required value={form.contact_person} onChange={(e) => upd("contact_person", e.target.value)} data-testid="account-contact-person-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Phone Number</Label>
                  <Input required inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => upd("phone", e.target.value.replace(/[^0-9]/g, ""))} data-testid="account-phone-input" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">GST Number (optional)</Label>
                  <Input value={form.gst_number} onChange={(e) => upd("gst_number", e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold pt-2">
                <MapPin className="h-4 w-4" />
                Default Delivery Address
              </div>
              <p className="text-xs text-slate-500 -mt-2">Used to pre-fill checkout. You can still edit it per order.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-500">Address</Label>
                  <Input value={form.address} onChange={(e) => upd("address", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">City</Label>
                  <Input value={form.city} onChange={(e) => upd("city", e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={savingProfile} data-testid="account-save-profile">
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>

            <form onSubmit={saveEmail} className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4" />
                Change Email
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <Label className="text-xs text-slate-500">New Email</Label>
                  <Input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="account-email-input" />
                </div>
                <button type="submit" className="btn-primary" disabled={savingEmail} data-testid="account-save-email">
                  {savingEmail ? "Updating..." : "Update Email"}
                </button>
              </div>
            </form>

            <form onSubmit={changePassword} className="card-premium p-5 space-y-4" autoComplete="off">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole className="h-4 w-4" />
                Change Password
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-slate-500">Current Password</Label>
                  <PasswordInput required autoComplete="off" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">New Password</Label>
                  <PasswordInput required autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Confirm New Password</Label>
                  <PasswordInput required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={savingPw} data-testid="account-save-password">
                  {savingPw ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          <div className="card-premium p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" />
              Order History
            </div>
            {loadingOrders ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/order-tracking/${o.order_number}`}
                    className="block rounded-xl border border-slate-200 p-3 hover:border-brand-primary/40 transition-colors"
                    data-testid={`account-order-${o.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-xs text-slate-500 truncate">{o.order_number}</div>
                      <Badge variant="outline" className={`shrink-0 ${statusColor[o.status] || ""}`}>
                        {o.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-slate-500">
                        {o.created_at?.slice(0, 10)} · {o.items?.length} item(s)
                      </div>
                      <div className="text-sm font-semibold">{formatINR(o.grand_total)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
