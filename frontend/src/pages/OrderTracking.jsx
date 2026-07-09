import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, Package, CheckCircle2, Clock, Truck, ArrowRight } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { Input } from "@/components/ui/input";

const STAGES = [
  { key: "placed", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Clock },
  { key: "packed", label: "Packed", icon: Package },
  { key: "dispatched", label: "Dispatched", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

export default function OrderTracking() {
  const { orderNumber: paramOrder } = useParams();
  const nav = useNavigate();
  const [orderNo, setOrderNo] = useState(paramOrder || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (paramOrder) doSearch(paramOrder);
  }, [paramOrder]);

  const doSearch = async (num) => {
    setError("");
    setLoading(true);
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

  const currentIndex = order ? STAGES.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="py-12 md:py-16">
      <div className="container-x max-w-4xl">
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

        {order && (
          <div className="mt-10">
            <div className="card-premium p-6 md:p-8">
              <div className="flex flex-wrap justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Order Number</div>
                  <div className="font-heading font-bold text-xl text-slate-900" data-testid="order-number">{order.order_number}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Grand Total</div>
                  <div className="font-heading font-bold text-xl text-slate-900">{formatINR(order.grand_total)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Status</div>
                  <div className="mt-0.5">
                    <span className="chip !bg-emerald-50 !text-brand-emerald capitalize">{order.status}</span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-8 relative">
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-100" />
                <div className="space-y-6">
                  {STAGES.map((s, i) => {
                    const done = i <= currentIndex;
                    const active = i === currentIndex;
                    const timelineEvent = order.timeline?.find((t) => t.status === s.key);
                    return (
                      <div key={s.key} className="flex items-start gap-4 relative" data-testid={`timeline-${s.key}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center relative z-10 shrink-0 ${
                          done ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"
                        } ${active ? "ring-4 ring-sky-100" : ""}`}>
                          <s.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 pt-2">
                          <div className={`font-semibold ${done ? "text-slate-900" : "text-slate-400"}`}>{s.label}</div>
                          {timelineEvent && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {new Date(timelineEvent.at).toLocaleString("en-IN")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Items */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="font-heading font-semibold text-slate-900 mb-4">Order Items</div>
                <div className="space-y-3">
                  {order.items?.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      {it.image && <img src={it.image} alt={it.product_name} className="w-12 h-12 rounded-lg object-cover" />}
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{it.product_name}</div>
                        <div className="text-xs text-slate-500">{it.size} · Qty {it.quantity} × {formatINR(it.unit_price)}</div>
                      </div>
                      <div className="font-semibold text-slate-900">{formatINR(it.line_total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
