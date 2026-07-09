import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { IndianRupee, ShoppingBag, Package, MessagesSquare, ArrowRight, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { api, formatINR } from "@/lib/api";

const StatCard = ({ icon: Icon, label, value, sub, tint = "sky", testid }) => {
  const tints = {
    sky: "bg-sky-50 text-brand-primary",
    emerald: "bg-emerald-50 text-brand-emerald",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-500",
  };
  return (
    <div className="card-premium p-6" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tints[tint]}`}>
          <Icon className="w-5 h-5" strokeWidth={1.7} />
        </div>
      </div>
      <div className="mt-4 text-3xl font-heading font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-2">{sub}</div>}
    </div>
  );
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get("/admin/analytics/summary").then((r) => setData(r.data));
    api.get("/admin/orders").then((r) => setOrders(r.data.slice(0, 5)));
  }, []);

  if (!data) return <div className="text-slate-500">Loading dashboard…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Overview</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Dashboard</h1>
        </div>
        <div className="text-xs text-slate-500">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" data-testid="dashboard-stats">
        <StatCard icon={IndianRupee} label="Total Revenue" value={formatINR(data.total_revenue)} sub="Excludes cancelled" tint="sky" testid="stat-revenue" />
        <StatCard icon={ShoppingBag} label="Total Orders" value={data.total_orders} sub={`${data.pending_orders} pending`} tint="emerald" testid="stat-orders" />
        <StatCard icon={Package} label="Active Products" value={data.product_count} tint="amber" testid="stat-products" />
        <StatCard icon={MessagesSquare} label="Bulk Inquiries" value={data.bulk_inquiries} sub={`${data.new_bulk_inquiries} new`} tint="rose" testid="stat-inquiries" />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-5 mt-5">
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-heading font-bold text-lg">Revenue · Last 14 Days</div>
              <div className="text-xs text-slate-500">Daily revenue trend</div>
            </div>
            <div className="chip"><TrendingUp className="w-3 h-3" /> Live</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue_series} margin={{ left: -10, right: 5, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F4C81" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0F4C81" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" fontSize={10} stroke="#94A3B8" tickFormatter={(d) => d.slice(5)} />
                <YAxis fontSize={10} stroke="#94A3B8" />
                <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
                <Line type="monotone" dataKey="revenue" stroke="#0F4C81" strokeWidth={2.5} dot={{ fill: "#38BDF8", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-premium p-6">
          <div className="font-heading font-bold text-lg mb-4">Top Products</div>
          {data.top_products.length === 0 ? (
            <div className="text-sm text-slate-500">No sales yet.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_products} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" fontSize={10} stroke="#94A3B8" />
                  <YAxis type="category" dataKey="name" fontSize={10} width={110} stroke="#64748B" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
                  <Bar dataKey="quantity" fill="#10B981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mt-5">
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-heading font-bold text-lg">Recent Orders</div>
            <Link to="/admin/orders" className="text-xs font-semibold text-brand-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No orders yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((o) => (
                <div key={o.id} className="py-3 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{o.order_number}</div>
                    <div className="text-xs text-slate-500 truncate">{o.guest?.business_name} · {o.items?.length} items</div>
                  </div>
                  <div className="text-sm font-heading font-bold text-slate-900">{formatINR(o.grand_total)}</div>
                  <span className="chip capitalize hidden md:inline-flex">{o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card-premium p-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-brand-emerald flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-heading font-bold text-2xl text-slate-900">{data.delivered_orders}</div>
                <div className="text-xs text-slate-500">Delivered orders</div>
              </div>
            </div>
          </div>
          <div className="card-premium p-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="font-heading font-bold text-2xl text-slate-900">{data.pending_orders}</div>
                <div className="text-xs text-slate-500">Pending orders</div>
              </div>
            </div>
          </div>
          <div className="card-premium p-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                <MessagesSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="font-heading font-bold text-2xl text-slate-900">{data.new_contact_messages}</div>
                <div className="text-xs text-slate-500">New contact messages</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
