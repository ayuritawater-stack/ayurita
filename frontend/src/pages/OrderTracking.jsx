import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search, Package, CheckCircle2, Clock, Truck, ArrowRight, FileText, MessageCircle, Circle, Undo2 } from "lucide-react";
import { api, formatINR, API, isCustomerLoggedIn } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STAGES = [
  { key: "placed", label: "Order Placed", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "packed", label: "Packed", icon: Package },
  { key: "dispatched", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

export default function OrderTracking() {
  const BUSINESS = useSettings();
  const { orderNumber: paramOrder } = useParams();
  const nav = useNavigate();
  const [orderNo, setOrderNo] = useState(paramOrder || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSubmitted, setReturnSubmitted] = useState(false);

  useEffect(() => {
    if (paramOrder) doSearch(paramOrder);
  }, [paramOrder]);

  const submitReturn = async (e) => {
    e.preventDefault();
    setSubmittingReturn(true);
    try {
      await api.post(`/orders/${order.order_number}/return`, { reason: returnReason });
      setReturnSubmitted(true);
      setShowReturnForm(false);
      toast.success("Return request submitted — we'll review it shortly.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit return request");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const doSearch = async (num) => {
    setError("");
    setLoading(true);
    setReturnSubmitted(false);
    setShowReturnForm(false);
    try {
      const { data } = await api.get(`/orders/track/${num}`);
      setOrder(data);
    } catch {
      setOrder(null);
      setError("Order not found. Please check your order number.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!orderNo.trim()) return;
    nav(`/order-tracking/${orderNo.trim()}`);
    doSearch(orderNo.trim());
  };

  const handleDownloadInvoice = () => {
    if (order.status !== "delivered") {
      toast.error("Invoice will be available for download once your order is delivered.");
      return;
    }
    window.open(`${API}/orders/${order.order_number}/invoice.pdf`, "_blank", "noopener,noreferrer");
  };

  const currentIndex = order ? STAGES.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="mb-10 max-w-xl">
          <div className="text-eyebrow mb-3">Track Order</div>
          <h1 className="h-hero !text-4xl md:!text-5xl">Where's my order?</h1>
          <p className="text-slate-600 mt-3">Enter your order number to see real-time status updates.</p>
        </div>

        <form onSubmit={submit} className="card-premium p-4 flex gap-2" data-testid="tracking-form">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="AYU-20260709-XXXXX"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
              className="pl-9 rounded-xl border-0"
              data-testid="tracking-input"
            />
          </div>
          <button type="submit" className="btn-primary" data-testid="tracking-submit" disabled={loading}>
            {loading ? "Searching…" : "Track"} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {error && <div className="mt-6 p-4 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</div>}

        {order && order.status === "cancelled" && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 text-rose-700 text-sm font-medium">This order has been cancelled.</div>
        )}

        {order && order.status !== "cancelled" && (
          <div className="mt-8 space-y-4">
            <div className="card-premium p-6 md:p-8">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Order</div>
                  <div className="font-heading font-bold text-lg text-slate-900" data-testid="order-number">{order.order_number}</div>
                </div>
                <Badge className="text-sm uppercase bg-brand-primary hover:bg-brand-primary">{order.status}</Badge>
              </div>

              {/* Horizontal stepper */}
              <div className="mt-8">
                <div className="hidden sm:flex items-center justify-between relative">
                  <div className="absolute top-5 left-5 right-5 h-1 bg-slate-100 rounded-full">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all"
                      style={{ width: `${(Math.max(0, currentIndex) / (STAGES.length - 1)) * 100}%` }}
                    />
                  </div>
                  {STAGES.map((s, i) => {
                    const done = i <= currentIndex;
                    return (
                      <div key={s.key} className="relative flex flex-col items-center gap-2 flex-1" data-testid={`timeline-${s.key}`}>
                        <div
                          className={`h-10 w-10 rounded-full grid place-items-center border-2 ${
                            done ? "bg-brand-primary border-brand-primary text-white" : "bg-white border-slate-200 text-slate-400"
                          }`}
                        >
                          <s.icon className="h-4 w-4" />
                        </div>
                        <div className={`text-xs font-medium text-center ${done ? "text-slate-900" : "text-slate-400"}`}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Mobile stepper */}
                <div className="sm:hidden space-y-3">
                  {STAGES.map((s, i) => {
                    const done = i <= currentIndex;
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full grid place-items-center ${done ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                          <s.icon className="h-4 w-4" />
                        </div>
                        <div className={`text-sm ${done ? "text-slate-900" : "text-slate-400"}`}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline log */}
              {order.timeline?.length > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-4">
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-3">Timeline</div>
                  <div className="space-y-2">
                    {[...order.timeline].reverse().map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Circle className="h-2 w-2 fill-brand-primary text-brand-primary shrink-0" />
                        <span className="font-medium capitalize text-slate-900">{h.status}</span>
                        {h.note && <span className="text-xs text-slate-500">{h.note}</span>}
                        <span className="text-slate-400 text-xs ml-auto whitespace-nowrap">{h.at?.slice(0, 16).replace("T", " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order details */}
            <div className="card-premium p-6 md:p-8">
              <div className="font-heading font-semibold text-slate-900 mb-4">Order Details</div>
              <div className="space-y-2 text-sm">
                {order.items?.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="text-slate-700">{it.product_name} × {it.quantity}</div>
                    <div className="text-slate-900">{formatINR(it.line_total)}</div>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-2 flex justify-between text-slate-700">
                  <span>Subtotal</span><span>{formatINR(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-brand-emerald">
                    <span>Discount</span><span>-{formatINR(order.discount)}</span>
                  </div>
                )}
                {order.shipping > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Shipping</span><span>{formatINR(order.shipping)}</span>
                  </div>
                )}
                <div className="flex justify-between font-heading font-bold text-lg pt-1 text-slate-900">
                  <span>Total</span><span>{formatINR(order.grand_total)}</span>
                </div>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <b className="text-slate-700">Delivery:</b> {order.guest?.contact_person}, {order.guest?.address}, {order.guest?.city}
                </div>
                <div>
                  <b className="text-slate-700">Payment:</b> {order.payment_method?.toUpperCase()}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={handleDownloadInvoice} className="btn-secondary" data-testid="track-download-invoice">
                  <FileText className="w-4 h-4" /> Download Invoice PDF
                </button>
                <a
                  href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`Hi, I want an update on order ${order.order_number}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                {order.status === "delivered" && isCustomerLoggedIn() && !returnSubmitted && !order.return_status && (
                  <button type="button" onClick={() => setShowReturnForm((s) => !s)} className="btn-secondary" data-testid="request-return-btn">
                    <Undo2 className="w-4 h-4" /> Request Return / Refund
                  </button>
                )}
                {(returnSubmitted || order.return_status) && (
                  <span className="chip !bg-amber-50 !text-amber-600 capitalize">
                    Return {order.return_status || "requested"}
                  </span>
                )}
              </div>

              {showReturnForm && (
                <form onSubmit={submitReturn} className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <textarea
                    required
                    placeholder="Tell us what went wrong (damaged, leaking, wrong item, etc.)"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm min-h-[80px]"
                    data-testid="return-reason-input"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setShowReturnForm(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={submittingReturn} data-testid="submit-return-btn">
                      {submittingReturn ? "Submitting…" : "Submit Request"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
