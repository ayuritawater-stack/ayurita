import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, X, User, MapPin, Phone, Mail, Package, FileDown, AlertTriangle, Archive } from "lucide-react";
import { api, formatINR, downloadFile } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["placed", "confirmed", "processing", "packed", "dispatched", "delivered", "cancelled"];

const statusStyles = {
  placed: "!bg-sky-50 !text-brand-primary",
  confirmed: "!bg-blue-50 !text-blue-700",
  processing: "!bg-amber-50 !text-amber-600",
  packed: "!bg-indigo-50 !text-indigo-600",
  dispatched: "!bg-violet-50 !text-violet-600",
  delivered: "!bg-emerald-50 !text-brand-emerald",
  cancelled: "!bg-rose-50 !text-rose-500",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("confirmed");
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [downloadingInvoices, setDownloadingInvoices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? { status: filter } : {};
    const { data } = await api.get("/admin/orders", { params });
    setOrders(data);
    setLoading(false);
  }, [filter]);
  useEffect(() => { setSelected([]); load(); }, [load]);

  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleSelectAll = () => setSelected((s) => (s.length === orders.length ? [] : orders.map((o) => o.id)));

  const applyBulkStatus = async () => {
    if (!window.confirm(`Update ${selected.length} order(s) to "${bulkStatus}"?`)) return;
    setApplyingBulk(true);
    try {
      const { data } = await api.put("/admin/orders/bulk/status", { order_ids: selected, status: bulkStatus });
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length) toast.error(`${failed.length} order(s) failed: ${failed[0].error}`);
      if (data.updated) toast.success(`${data.updated} order(s) updated`);
      setSelected([]);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Bulk update failed");
    } finally {
      setApplyingBulk(false);
    }
  };

  const downloadBulkInvoices = async () => {
    setDownloadingInvoices(true);
    try {
      await downloadFile(
        "/admin/orders/bulk/invoices",
        {},
        `Ayurita-Invoices-${new Date().toISOString().slice(0, 10)}.zip`,
        { method: "post", data: { order_ids: selected } },
      );
    } catch {
      toast.error("Failed to download invoices");
    } finally {
      setDownloadingInvoices(false);
    }
  };

  const downloadInvoice = async (id, orderNumber) => {
    try {
      const { data } = await api.get(`/admin/orders/${id}/invoice.pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Ayurita-Invoice-${orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download invoice");
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      toast.success(`Order marked ${status}`);
      load();
      if (detail?.id === id) {
        const { data } = await api.get(`/admin/orders/${id}`);
        setDetail(data);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Order #", "Business", "Contact", "Phone", "Email", "Items", "Grand Total", "Status", "Created"],
      ...orders.map((o) => [
        o.order_number, o.guest?.business_name, o.guest?.contact_person, o.guest?.phone, o.guest?.email,
        o.items?.length, o.grand_total, o.status, o.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ayurita-orders-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Orders</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Order Management</h1>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40 rounded-xl" data-testid="orders-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={exportCSV} className="btn-secondary" data-testid="export-orders">Export CSV</button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="card-premium p-4 mb-6 flex flex-wrap items-center gap-3" data-testid="bulk-actions-bar">
          <span className="text-sm font-semibold text-slate-900">{selected.length} selected</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-40 rounded-xl" data-testid="bulk-status-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={applyBulkStatus} disabled={applyingBulk} className="btn-secondary" data-testid="apply-bulk-status">
            {applyingBulk ? "Updating…" : "Update Status"}
          </button>
          <button onClick={downloadBulkInvoices} disabled={downloadingInvoices} className="btn-secondary" data-testid="bulk-download-invoices">
            <Archive className="w-4 h-4" /> {downloadingInvoices ? "Zipping…" : "Download Invoices (ZIP)"}
          </button>
          <button onClick={() => setSelected([])} className="text-xs text-slate-500 hover:text-slate-700 ml-auto">Clear selection</button>
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3 w-10">
                <input
                  type="checkbox"
                  checked={orders.length > 0 && selected.length === orders.length}
                  onChange={toggleSelectAll}
                  data-testid="select-all-orders"
                />
              </th>
              <th className="text-left px-6 py-3">Order #</th>
              <th className="text-left px-6 py-3">Business</th>
              <th className="text-left px-6 py-3">Items</th>
              <th className="text-left px-6 py-3">Total</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="8" className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="8" className="p-8 text-center text-slate-500">No orders found.</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50" data-testid={`order-row-${o.order_number}`}>
                <td className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggleSelect(o.id)}
                    data-testid={`select-order-${o.order_number}`}
                  />
                </td>
                <td className="px-6 py-3 font-mono text-xs text-slate-900 font-semibold">
                  <div className="flex items-center gap-1.5">
                    {o.order_number}
                    {o.flagged_for_review && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" data-testid={`flag-${o.order_number}`} />}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="font-semibold text-slate-900">{o.guest?.business_name}</div>
                  <div className="text-xs text-slate-500">{o.guest?.contact_person}</div>
                </td>
                <td className="px-6 py-3">{o.items?.length}</td>
                <td className="px-6 py-3 font-semibold">{formatINR(o.grand_total)}</td>
                <td className="px-6 py-3">
                  <span className={`chip capitalize ${statusStyles[o.status] || ""}`}>{o.status}</span>
                </td>
                <td className="px-6 py-3 text-xs text-slate-500">
                  {new Date(o.created_at).toLocaleDateString("en-IN")}
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => setDetail(o)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center" data-testid={`view-order-${o.order_number}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex" data-testid="order-drawer">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <div>
                <div className="text-xs text-slate-500">Order</div>
                <div className="font-heading font-bold">{detail.order_number}</div>
                {detail.flagged_for_review && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold mt-1" data-testid="order-flag-banner">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Needs review — {detail.flag_reasons?.map((r) => (r === "large_order" ? "large order" : "first credit order")).join(", ")}
                  </div>
                )}
              </div>
              <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Update Status</div>
                <Select value={detail.status} onValueChange={(v) => changeStatus(detail.id, v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="card-premium p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Customer</div>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2"><User className="w-4 h-4 text-slate-400 shrink-0" /><span>{detail.guest?.business_name} · {detail.guest?.contact_person}</span></div>
                  <div className="flex gap-2"><Phone className="w-4 h-4 text-slate-400 shrink-0" /><a href={`tel:${detail.guest?.phone}`}>{detail.guest?.phone}</a></div>
                  <div className="flex gap-2"><Mail className="w-4 h-4 text-slate-400 shrink-0" /><a href={`mailto:${detail.guest?.email}`}>{detail.guest?.email}</a></div>
                  <div className="flex gap-2"><MapPin className="w-4 h-4 text-slate-400 shrink-0" /><span>{detail.guest?.address}, {detail.guest?.city}{detail.guest?.state ? `, ${detail.guest.state}` : ""}{detail.guest?.pincode ? ` - ${detail.guest.pincode}` : ""}</span></div>
                  {detail.guest?.gst_number && <div className="text-xs text-slate-500">GST: {detail.guest.gst_number}</div>}
                  {detail.guest?.notes && <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">Notes: {detail.guest.notes}</div>}
                </div>
              </div>

              <div className="card-premium p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Items</div>
                {detail.items?.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                    {it.image && <img src={it.image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                    <div className="flex-1 text-sm">
                      <div className="font-semibold">{it.product_name}</div>
                      <div className="text-xs text-slate-500">{it.size} · {it.quantity} × {formatINR(it.unit_price)}</div>
                    </div>
                    <div className="font-semibold text-sm">{formatINR(it.line_total)}</div>
                  </div>
                ))}
              </div>

              <div className="card-premium p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{formatINR(detail.subtotal)}</span></div>
                {detail.discount > 0 && <div className="flex justify-between text-brand-emerald"><span>Discount</span><span>-{formatINR(detail.discount)}</span></div>}
                <div className="flex justify-between"><span className="text-slate-600">CGST</span><span>{formatINR(detail.cgst_total ?? detail.gst_total / 2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">SGST</span><span>{formatINR(detail.sgst_total ?? detail.gst_total / 2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Shipping{detail.distance_km ? ` (${detail.distance_km} km)` : ""}</span><span>{formatINR(detail.shipping)}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold">Grand Total</span>
                  <span className="font-heading font-bold text-lg">{formatINR(detail.grand_total)}</span>
                </div>
              </div>

              <div className="card-premium p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Timeline</div>
                <div className="space-y-2">
                  {(detail.timeline || []).map((t, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-brand-primary" />
                      <span className="capitalize font-semibold">{t.status}</span>
                      <span className="text-xs text-slate-500">{new Date(t.at).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => downloadInvoice(detail.id, detail.order_number)}
                  className="btn-primary col-span-2"
                  data-testid="download-invoice-pdf"
                >
                  <FileDown className="w-4 h-4" /> Download GST Invoice (PDF)
                </button>
                <button onClick={() => window.print()} className="btn-secondary col-span-2"><Package className="w-4 h-4" /> Print / Save Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
