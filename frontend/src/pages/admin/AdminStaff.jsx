import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const emptyForm = { email: "", password: "", name: "", admin_role: "staff" };

const errorMessage = (err, fallback) => err.response?.data?.detail || fallback;

export default function AdminStaff() {
  const { admin } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/staff");
      setStaff(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load staff accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const createStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/staff", form);
      toast.success("Staff account created");
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create staff account"));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (id, admin_role) => {
    try {
      await api.put(`/admin/staff/${id}/role`, { admin_role });
      setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, admin_role } : s)));
      toast.success("Role updated");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update role"));
    }
  };

  const removeStaff = async (id) => {
    if (!window.confirm("Remove this admin account? They will be logged out immediately.")) return;
    try {
      await api.delete(`/admin/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
      toast.success("Admin account removed");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove account"));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Access Control</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Staff Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Staff accounts can view and update orders, bulk inquiries, and contact messages — they cannot change
            products, pricing, coupons, settings, or other admin accounts.
          </p>
        </div>
        <button className="btn-primary gap-2 inline-flex items-center" onClick={() => setShowForm((s) => !s)} data-testid="add-staff-btn">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {showForm && (
        <form onSubmit={createStaff} className="card-premium p-6 mb-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label>Email</Label>
            <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label>Password</Label>
            <PasswordInput required autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.admin_role} onValueChange={(v) => set("admin_role", v)}>
              <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff (orders only)</SelectItem>
                <SelectItem value="owner">Owner (full access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Account"}</button>
          </div>
        </form>
      )}

      <div className="card-premium p-6">
        <div className="flex items-center gap-2 font-heading font-bold text-lg mb-5">
          <Users className="w-4 h-4" /> All Admins
        </div>
        {loading ? (
          <div className="text-slate-500">Loading…</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((s) => (
              <div key={s.id} className="py-3 flex items-center gap-4" data-testid={`staff-row-${s.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                  <div className="text-xs text-slate-500 truncate">{s.email}</div>
                </div>
                <Badge variant="outline" className={s.admin_role === "owner" ? "!bg-sky-50 !text-brand-primary" : "!bg-slate-50 !text-slate-600"}>
                  {s.admin_role === "owner" ? "Owner" : "Staff"}
                </Badge>
                <Select value={s.admin_role} onValueChange={(v) => changeRole(s.id, v)} disabled={s.id === admin?.id}>
                  <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => removeStaff(s.id)}
                  disabled={s.id === admin?.id}
                  className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition disabled:opacity-40"
                  aria-label="Remove admin"
                  data-testid={`remove-staff-${s.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
