import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { IndianRupee, ShoppingBag, TrendingUp, Repeat, AlertTriangle } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const reorderUrgency = (days) =>
  days <= 7 ? "!bg-rose-50 !text-rose-600" : days <= 14 ? "!bg-amber-50 !text-amber-600" : "!bg-slate-100 !text-slate-500";

export default function AdminAnalytics() {
  const [days, setDays] = useState("30");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/admin/analytics", { params: { days } }).then((r) => setStats(r.data)).finally(() => setLoading(false));
  }, [days]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Analytics</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Sales Analytics</h1>
        </div>
        <Tabs value={days} onValueChange={setDays} data-testid="analytics-range">
          <TabsList>
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
            <TabsTrigger value="90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading || !stats ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            {[
              { label: "Revenue", value: formatINR(stats.total_revenue_range), icon: IndianRupee, tint: "sky" },
              { label: "Orders", value: stats.total_orders_range, icon: ShoppingBag, tint: "emerald" },
              { label: "Avg Order Value", value: formatINR(stats.avg_order_value), icon: TrendingUp, tint: "amber" },
              { label: "Repeat Customer Rate", value: `${stats.repeat_rate}%`, icon: Repeat, tint: "rose" },
            ].map(({ label, value, icon: Icon, tint }) => {
              const tints = { sky: "bg-sky-50 text-brand-primary", emerald: "bg-emerald-50 text-brand-emerald", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-500" };
              return (
                <div key={label} className="card-premium p-6" data-testid={`analytics-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tints[tint]}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.7} />
                  </div>
                  <div className="mt-4 text-2xl font-heading font-bold text-slate-900">{value}</div>
                  <div className="text-sm text-slate-500 mt-1">{label}</div>
                </div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            <div className="lg:col-span-2 card-premium p-6">
              <div className="font-heading font-bold text-lg mb-4">Revenue trend ({stats.days} days)</div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                  <LineChart data={stats.revenue_trend} margin={{ left: -10, right: 5, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" fontSize={10} stroke="#94A3B8" tickFormatter={(d) => d.slice(5)} minTickGap={20} />
                    <YAxis fontSize={10} stroke="#94A3B8" />
                    <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
                    <Line type="monotone" dataKey="revenue" stroke="#0F4C81" strokeWidth={2.5} dot={{ fill: "#38BDF8", r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-premium p-6">
              <div className="font-heading font-bold text-lg mb-4">Customers ({stats.days} days)</div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Repeat customers</span>
                  <span className="font-heading font-bold text-slate-900">{stats.repeat_customers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">One-time customers</span>
                  <span className="font-heading font-bold text-slate-900">{stats.one_time_customers}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-600">Total customers</span>
                  <span className="font-heading font-bold text-slate-900">{stats.total_customers_range}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card-premium overflow-hidden">
              <div className="font-heading font-bold text-lg p-6 pb-0">Top Products by Revenue</div>
              <table className="w-full text-sm mt-4">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="text-left px-6 py-3">Product</th><th className="text-left px-6 py-3">Qty</th><th className="text-left px-6 py-3">Revenue</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.top_products.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-8 text-slate-500">No sales in this range.</td></tr>
                  ) : stats.top_products.map((p) => (
                    <tr key={p.product_id}>
                      <td className="px-6 py-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="px-6 py-3">{p.qty}</td>
                      <td className="px-6 py-3">{formatINR(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-premium overflow-hidden">
              <div className="flex items-center gap-2 font-heading font-bold text-lg p-6 pb-0">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Reorder Suggestions
              </div>
              <p className="text-xs text-slate-500 px-6 pt-1">Estimated from sales velocity over the last {stats.days} days.</p>
              <table className="w-full text-sm mt-4">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="text-left px-6 py-3">Product</th><th className="text-left px-6 py-3">Stock</th><th className="text-left px-6 py-3">Sold/Day</th><th className="text-left px-6 py-3">Est. Days Left</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.reorder_suggestions.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-8 text-slate-500">Nothing projected to run out within 30 days.</td></tr>
                  ) : stats.reorder_suggestions.map((p) => (
                    <tr key={p.product_id}>
                      <td className="px-6 py-3">
                        <Link to="/admin/products" className="font-semibold text-slate-900 hover:text-brand-primary">{p.name}</Link>
                      </td>
                      <td className="px-6 py-3">{p.stock}</td>
                      <td className="px-6 py-3">{p.daily_velocity}</td>
                      <td className="px-6 py-3"><span className={`chip ${reorderUrgency(p.days_left)}`}>{p.days_left} days</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
