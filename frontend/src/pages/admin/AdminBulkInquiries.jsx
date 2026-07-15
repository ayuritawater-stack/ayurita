import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, X, User, Phone, Mail, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = ["new", "accepted", "rejected", "completed"];

const statusStyles = {
  new: "!bg-sky-50 !text-brand-primary",
  accepted: "!bg-emerald-50 !text-brand-emerald",
  rejected: "!bg-rose-50 !text-rose-500",
  completed: "!bg-slate-100 !text-slate-600",
};

export default function AdminBulkInquiries() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? { status: filter } : {};
    const { data } = await api.get("/admin/bulk-inquiries", { params });
    setItems(data);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const update = async (status, admin_reply) => {
    try {
      await api.put(`/admin/bulk-inquiries/${detail.id}`, { status, admin_reply });
      toast.success("Inquiry updated");
      setDetail(null);
      load();
    } catch {
      toast.error("Update failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Bulk Inquiries</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Bulk Order Requests</h1>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-6 py-3">Business</th>
              <th className="text-left px-6 py-3">Contact</th>
              <th className="text-left px-6 py-3">Product</th>
              <th className="text-left px-6 py-3">Quantity</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">No inquiries.</td></tr>
            ) : items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50" data-testid={`inquiry-row-${it.id}`}>
                <td className="px-6 py-3 font-semibold text-slate-900">{it.business_name}</td>
                <td className="px-6 py-3">
                  <div>{it.contact_person}</div>
                  <div className="text-xs text-slate-500">{it.phone}</div>
                </td>
                <td className="px-6 py-3">{it.product || "—"} <span className="text-xs text-slate-500">{it.bottle_size}</span></td>
                <td className="px-6 py-3">{it.quantity || "—"}</td>
                <td className="px-6 py-3">
                  <span className={`chip capitalize ${statusStyles[it.status] || ""}`}>{it.status}</span>
                </td>
                <td className="px-6 py-3 text-xs text-slate-500">{new Date(it.created_at).toLocaleDateString("en-IN")}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => { setDetail(it); setReply(it.admin_reply || ""); }} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center" data-testid={`view-inquiry-${it.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex" data-testid="inquiry-drawer">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <div className="font-heading font-bold">Inquiry Details</div>
              <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="card-premium p-4 text-sm space-y-2">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Business</div>
                <div className="font-semibold text-slate-900">{detail.business_name}</div>
                <div className="flex gap-2"><User className="w-4 h-4 text-slate-400" /> {detail.contact_person}</div>
                <div className="flex gap-2"><Phone className="w-4 h-4 text-slate-400" /> <a href={`tel:${detail.phone}`}>{detail.phone}</a></div>
                <div className="flex gap-2"><Mail className="w-4 h-4 text-slate-400" /> <a href={`mailto:${detail.email}`}>{detail.email}</a></div>
              </div>

              <div className="card-premium p-4 text-sm">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Requirement</div>
                <div><span className="text-slate-500">Product:</span> {detail.product || "—"}</div>
                <div><span className="text-slate-500">Size:</span> {detail.bottle_size || "—"}</div>
                <div><span className="text-slate-500">Quantity:</span> {detail.quantity || "—"}</div>
                <div><span className="text-slate-500">Monthly:</span> {detail.monthly_requirement || "—"}</div>
                <div className="mt-2 pt-2 border-t border-slate-100"><span className="text-slate-500">Address:</span> {detail.delivery_address || "—"}</div>
                {detail.message && <div className="mt-2 pt-2 border-t border-slate-100"><span className="text-slate-500">Message:</span><br />{detail.message}</div>}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Admin Note / Reply</div>
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} className="rounded-xl min-h-[100px]" data-testid="inquiry-reply" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => update("accepted", reply)} className="btn-accent" data-testid="accept-inquiry">Accept</button>
                <button onClick={() => update("rejected", reply)} className="btn-secondary !text-rose-600" data-testid="reject-inquiry">Reject</button>
                <button onClick={() => update("completed", reply)} className="btn-secondary col-span-2">Mark Completed</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
