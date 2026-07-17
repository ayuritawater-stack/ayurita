import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, X, TicketPercent } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const EMPTY = { code: "", discount_type: "percent", value: 10, min_order: 0, max_discount: 0, usage_limit: 0, is_active: true, starts_at: null, expires_at: null };

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/coupons");
    setCoupons(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSave = async () => {
    const payload = {
      ...editing,
      value: Number(editing.value),
      min_order: Number(editing.min_order),
      max_discount: Number(editing.max_discount) || 0,
      usage_limit: Number(editing.usage_limit) || 0,
    };
    try {
      if (editing.id) await api.put(`/coupons/${editing.id}`, payload);
      else await api.post("/coupons", payload);
      toast.success("Coupon saved");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete coupon?")) return;
    await api.delete(`/coupons/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Coupons</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Discount Coupons</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary" data-testid="add-coupon">
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : coupons.length === 0 ? (
        <div className="card-premium p-12 text-center text-slate-500">No coupons yet.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <div key={c.id} className="card-premium p-6" data-testid={`coupon-${c.code}`}>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <TicketPercent className="w-5 h-5" />
                </div>
                <span className={`chip ${c.is_active ? "!bg-emerald-50 !text-brand-emerald" : "!bg-slate-100 !text-slate-500"}`}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="font-heading font-bold text-2xl text-slate-900 mt-4 font-mono">{c.code}</div>
              <div className="text-sm text-slate-600 mt-1">
                {c.discount_type === "percent" ? `${c.value}% off` : `${formatINR(c.value)} off`}
              </div>
              <div className="text-xs text-slate-500 mt-1">Min order {formatINR(c.min_order)}</div>
              {!!c.usage_limit && (
                <div className="text-xs text-slate-500">Used {c.used_count || 0} / {c.usage_limit}</div>
              )}
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setEditing({ ...c })} className="btn-secondary flex-1 !py-2"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => onDelete(c.id)} className="w-10 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex" data-testid="coupon-drawer">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between">
              <div className="font-heading font-bold">{editing.id ? "Edit Coupon" : "New Coupon"}</div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Code *</Label>
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="mt-1.5 rounded-xl font-mono" data-testid="coupon-code" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={editing.discount_type} onValueChange={(v) => setEditing({ ...editing, discount_type: v })}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input type="number" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="mt-1.5 rounded-xl" data-testid="coupon-value" />
              </div>
              <div>
                <Label>Minimum Order (₹)</Label>
                <Input type="number" value={editing.min_order} onChange={(e) => setEditing({ ...editing, min_order: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              {editing.discount_type === "percent" && (
                <div>
                  <Label>Max Discount Cap (₹, 0 = no cap)</Label>
                  <Input type="number" value={editing.max_discount ?? 0} onChange={(e) => setEditing({ ...editing, max_discount: e.target.value })} className="mt-1.5 rounded-xl" />
                </div>
              )}
              <div>
                <Label>Usage Limit (0 = unlimited)</Label>
                <Input type="number" value={editing.usage_limit ?? 0} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Starts At (optional)</Label>
                <Input type="datetime-local" value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Expires At (optional)</Label>
                <Input type="datetime-local" value={editing.expires_at ? editing.expires_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1.5 rounded-xl" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm">Active</span>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={onSave} className="btn-primary flex-1" data-testid="save-coupon">Save</button>
                <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
