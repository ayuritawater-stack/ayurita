import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Trash2, Star } from "lucide-react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["pending", "approved", "rejected"];

const statusStyles = {
  pending: "!bg-amber-50 !text-amber-600",
  approved: "!bg-emerald-50 !text-brand-emerald",
  rejected: "!bg-rose-50 !text-rose-500",
};

export default function AdminReviews() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? { status: filter } : {};
    const { data } = await api.get("/admin/reviews", { params });
    setItems(data);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try {
      await api.put(`/admin/reviews/${id}/status`, { status });
      toast.success(`Review ${status}`);
      load();
    } catch {
      toast.error("Update failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this review permanently?")) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      toast.success("Review deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Business", "Rating", "Comment", "Status", "Date"],
      ...items.map((r) => [r.business_name, r.rating, r.comment, r.status, r.created_at]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ayurita-reviews-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Reviews</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Product Reviews</h1>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={exportCSV} className="btn-secondary" data-testid="export-reviews">Export CSV</button>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-6 py-3">Business</th>
              <th className="text-left px-6 py-3">Rating</th>
              <th className="text-left px-6 py-3">Comment</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-slate-500">No reviews.</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50" data-testid={`review-row-${r.id}`}>
                <td className="px-6 py-3 font-semibold text-slate-900">{r.business_name}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-3 max-w-xs truncate">{r.comment || "—"}</td>
                <td className="px-6 py-3">
                  <span className={`chip capitalize ${statusStyles[r.status] || ""}`}>{r.status}</span>
                </td>
                <td className="px-6 py-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    {r.status !== "approved" && (
                      <button onClick={() => setStatus(r.id, "approved")} className="w-8 h-8 rounded-lg bg-emerald-50 text-brand-emerald hover:bg-emerald-100 inline-flex items-center justify-center" data-testid={`approve-review-${r.id}`}>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button onClick={() => setStatus(r.id, "rejected")} className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 inline-flex items-center justify-center" data-testid={`reject-review-${r.id}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => remove(r.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 inline-flex items-center justify-center" data-testid={`delete-review-${r.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
