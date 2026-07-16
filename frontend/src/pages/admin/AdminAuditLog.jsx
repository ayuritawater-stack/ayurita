import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

const actionLabels = {
  admin_login: "Admin login",
  change_email: "Changed email",
  change_password: "Changed password",
  logout_all_devices: "Logged out all devices",
  create_staff_account: "Created staff account",
  update_staff_role: "Updated staff role",
  delete_staff_account: "Deleted staff account",
  set_credit_limit: "Set credit limit",
  record_credit_payment: "Recorded credit payment",
  resolve_credit_request: "Resolved credit request",
  resolve_return_request: "Resolved return request",
  update_settings: "Updated business settings",
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/audit-logs", { params: emailFilter ? { admin_email: emailFilter } : {} });
      setLogs(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Security</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Audit Log</h1>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <Input placeholder="Filter by admin email" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} className="rounded-xl w-56" />
          <button type="submit" className="btn-secondary">Filter</button>
        </form>
      </div>

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-6 py-3">Action</th>
              <th className="text-left px-6 py-3">Admin</th>
              <th className="text-left px-6 py-3">IP Address</th>
              <th className="text-left px-6 py-3">Details</th>
              <th className="text-left px-6 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">No audit entries yet.</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50" data-testid={`audit-row-${l.id}`}>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                    {actionLabels[l.action] || l.action}
                  </div>
                </td>
                <td className="px-6 py-3 text-slate-600">{l.admin_email}</td>
                <td className="px-6 py-3 text-xs text-slate-500">{l.ip_address}</td>
                <td className="px-6 py-3 text-xs text-slate-500 max-w-xs truncate">
                  {l.details && Object.keys(l.details).length > 0 ? JSON.stringify(l.details) : "—"}
                </td>
                <td className="px-6 py-3 text-xs text-slate-500">{l.timestamp?.slice(0, 19).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
