import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, IndianRupee } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["pending", "approved", "rejected", "refunded"];

const statusStyles = {
  pending: "!bg-amber-50 !text-amber-600",
  approved: "!bg-sky-50 !text-brand-primary",
  rejected: "!bg-rose-50 !text-rose-500",
  refunded: "!bg-emerald-50 !text-brand-emerald",
};

export default function AdminReturns() {
  const { admin } = useAuth();
  const isOwner = (admin?.admin_role || "owner") === "owner";
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [refundAmounts, setRefundAmounts] = useState({});
  const [resolvingId, setResolvingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/returns");
      setItems(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load return requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? items : items.filter((r) => r.status === filter);

  const resolve = async (r, status) => {
    setResolvingId(r.id);
    try {
      await api.put(`/admin/returns/${r.id}/status`, {
        status,
        refund_amount: status === "refunded" ? Number(refundAmounts[r.id] || 0) : null,
      });
      toast.success(`Return request ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update request");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Support</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Returns &amp; Refunds</h1>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="card-premium p-8 text-center text-slate-500">No return requests.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <div key={r.id} className="card-premium p-4" data-testid={`return-row-${r.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-slate-900">{r.business_name} · <span className="font-mono text-xs text-slate-500">{r.order_number}</span></div>
                  <div className="text-sm text-slate-600 mt-1">{r.reason}</div>
                  {r.resolution_note && <div className="text-xs text-slate-500 mt-1">Note: {r.resolution_note}</div>}
                  {r.refund_amount != null && <div className="text-xs text-brand-emerald mt-1">Refunded {formatINR(r.refund_amount)}</div>}
                </div>
                <span className={`chip capitalize ${statusStyles[r.status] || ""}`}>{r.status}</span>
              </div>

              {isOwner && r.status === "pending" && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <button onClick={() => resolve(r, "approved")} disabled={resolvingId === r.id} className="btn-secondary !py-1.5" data-testid={`approve-return-${r.id}`}>
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => resolve(r, "rejected")} disabled={resolvingId === r.id} className="btn-secondary !py-1.5 !text-rose-600" data-testid={`reject-return-${r.id}`}>
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}

              {isOwner && r.status === "approved" && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <Input
                    type="number"
                    placeholder="Refund amount"
                    value={refundAmounts[r.id] || ""}
                    onChange={(e) => setRefundAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-40 rounded-xl"
                    data-testid={`refund-amount-${r.id}`}
                  />
                  <button onClick={() => resolve(r, "refunded")} disabled={resolvingId === r.id} className="btn-primary !py-1.5" data-testid={`refund-return-${r.id}`}>
                    <IndianRupee className="w-3.5 h-3.5" /> Mark Refunded
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
