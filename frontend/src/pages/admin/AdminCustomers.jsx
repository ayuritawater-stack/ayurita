import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, X, Wallet, IndianRupee, Check, XCircle } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [creditOrders, setCreditOrders] = useState([]);
  const [limitInput, setLimitInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [payAmounts, setPayAmounts] = useState({});
  const [payingId, setPayingId] = useState(null);
  const [creditRequests, setCreditRequests] = useState([]);
  const [approveAmounts, setApproveAmounts] = useState({});
  const [resolvingId, setResolvingId] = useState(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/customers");
      setCustomers(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const loadCreditRequests = async () => {
    try {
      const { data } = await api.get("/admin/credit-requests", { params: { status: "pending" } });
      setCreditRequests(data);
      setApproveAmounts(Object.fromEntries(data.map((r) => [r.id, String(r.requested_amount)])));
    } catch {
      setCreditRequests([]);
    }
  };

  useEffect(() => { load(); loadCreditRequests(); }, []);

  const resolveRequest = async (req, status) => {
    setResolvingId(req.id);
    try {
      await api.put(`/admin/credit-requests/${req.id}`, {
        status,
        approved_limit: status === "approved" ? Number(approveAmounts[req.id] || req.requested_amount) : null,
      });
      setCreditRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success(status === "approved" ? "Credit request approved" : "Credit request rejected");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to resolve request");
    } finally {
      setResolvingId(null);
    }
  };

  const sendReminders = async () => {
    setSendingReminders(true);
    try {
      const { data } = await api.post("/admin/credit-reminders/run");
      toast.success(`Sent ${data.sent} reminder(s)`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send reminders");
    } finally {
      setSendingReminders(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Business", "Contact", "Email", "Credit Limit", "Outstanding"],
      ...customers.map((c) => [c.business_name, c.contact_person, c.email, c.credit_limit || 0, c.credit_balance || 0]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ayurita-customers-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = async (c) => {
    setDetail(c);
    setLimitInput(String(c.credit_limit || 0));
    try {
      const { data } = await api.get("/admin/orders", { params: { customer_id: c.id } });
      setCreditOrders(data.filter((o) => o.payment_method === "credit"));
    } catch {
      setCreditOrders([]);
    }
  };

  const saveLimit = async () => {
    setSavingLimit(true);
    try {
      const { data } = await api.put(`/admin/customers/${detail.id}/credit-limit`, { credit_limit: Number(limitInput || 0) });
      setCustomers((prev) => prev.map((c) => (c.id === detail.id ? data : c)));
      setDetail(data);
      toast.success("Credit limit updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update limit");
    } finally {
      setSavingLimit(false);
    }
  };

  const recordPayment = async (order) => {
    const amount = Number(payAmounts[order.id] || 0);
    if (!amount || amount <= 0) return toast.error("Enter a valid payment amount");
    setPayingId(order.id);
    try {
      const { data } = await api.post(`/admin/customers/${detail.id}/orders/${order.id}/payments`, { amount });
      setCreditOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
      setPayAmounts((prev) => ({ ...prev, [order.id]: "" }));
      load();
      toast.success("Payment recorded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Wholesale Credit</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Customers & Credit</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={sendReminders} disabled={sendingReminders} className="btn-secondary" data-testid="send-reminders">
            {sendingReminders ? "Sending…" : "Send Due Reminders Now"}
          </button>
          <button onClick={exportCSV} className="btn-secondary" data-testid="export-customers">Export CSV</button>
        </div>
      </div>

      {creditRequests.length > 0 && (
        <div className="card-premium p-6 mb-6">
          <div className="font-heading font-bold text-lg mb-4">Pending Credit Requests</div>
          <div className="space-y-3">
            {creditRequests.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap" data-testid={`credit-request-${r.id}`}>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-semibold text-slate-900">{r.business_name}</div>
                  <div className="text-xs text-slate-500">Requested {formatINR(r.requested_amount)}{r.note && ` — ${r.note}`}</div>
                </div>
                <Input
                  type="number"
                  value={approveAmounts[r.id] || ""}
                  onChange={(e) => setApproveAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-32 rounded-xl"
                  data-testid={`approve-amount-${r.id}`}
                />
                <button
                  onClick={() => resolveRequest(r, "approved")}
                  disabled={resolvingId === r.id}
                  className="w-9 h-9 rounded-lg bg-emerald-50 text-brand-emerald hover:bg-emerald-100 inline-flex items-center justify-center"
                  data-testid={`approve-request-${r.id}`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => resolveRequest(r, "rejected")}
                  disabled={resolvingId === r.id}
                  className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 inline-flex items-center justify-center"
                  data-testid={`reject-request-${r.id}`}
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-6 py-3">Business</th>
              <th className="text-left px-6 py-3">Contact</th>
              <th className="text-left px-6 py-3">Credit Limit</th>
              <th className="text-left px-6 py-3">Outstanding</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">No customers yet.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50" data-testid={`customer-row-${c.id}`}>
                <td className="px-6 py-3 font-semibold text-slate-900">{c.business_name}</td>
                <td className="px-6 py-3">
                  <div>{c.contact_person}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td className="px-6 py-3">{formatINR(c.credit_limit || 0)}</td>
                <td className="px-6 py-3">
                  <span className={c.credit_balance > 0 ? "text-amber-600 font-semibold" : "text-slate-500"}>
                    {formatINR(c.credit_balance || 0)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => openDetail(c)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center" data-testid={`view-customer-${c.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex" data-testid="customer-drawer">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <div className="font-heading font-bold">{detail.business_name}</div>
              <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="card-premium p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                  <Wallet className="w-3.5 h-3.5" /> Credit Limit
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Limit (₹)</Label>
                    <Input type="number" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} className="mt-1 rounded-xl" data-testid="credit-limit-input" />
                  </div>
                  <button onClick={saveLimit} disabled={savingLimit} className="btn-primary" data-testid="save-credit-limit">
                    {savingLimit ? "Saving…" : "Save"}
                  </button>
                </div>
                <div className="text-xs text-slate-500">Outstanding: {formatINR(detail.credit_balance || 0)}</div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-2">
                  <IndianRupee className="w-3.5 h-3.5" /> Credit Orders
                </div>
                {creditOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No credit orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {creditOrders.map((o) => {
                      const remaining = Math.max(0, o.grand_total - (o.amount_paid || 0));
                      return (
                        <div key={o.id} className="rounded-xl border border-slate-200 p-3" data-testid={`credit-order-${o.id}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs text-slate-500">{o.order_number}</span>
                            <span className={`chip capitalize ${o.credit_status === "paid" ? "!bg-emerald-50 !text-brand-emerald" : o.credit_status === "partial" ? "!bg-amber-50 !text-amber-600" : "!bg-rose-50 !text-rose-500"}`}>
                              {o.credit_status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Total {formatINR(o.grand_total)} · Paid {formatINR(o.amount_paid || 0)} · Due by {o.credit_due_date?.slice(0, 10)}
                          </div>
                          {remaining > 0 && (
                            <div className="flex items-end gap-2 mt-2">
                              <Input
                                type="number"
                                placeholder={`Up to ${remaining.toFixed(2)}`}
                                value={payAmounts[o.id] || ""}
                                onChange={(e) => setPayAmounts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                className="rounded-xl"
                                data-testid={`pay-amount-${o.id}`}
                              />
                              <button
                                onClick={() => recordPayment(o)}
                                disabled={payingId === o.id}
                                className="btn-secondary whitespace-nowrap"
                                data-testid={`record-payment-${o.id}`}
                              >
                                {payingId === o.id ? "Saving…" : "Record Payment"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
