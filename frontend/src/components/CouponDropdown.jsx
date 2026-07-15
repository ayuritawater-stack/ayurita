import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function CouponDropdown({ onSelect }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/coupons");
        setCoupons(data.filter((coupon) => coupon.is_active));
      } catch (err) {
        setCoupons([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading coupons…</p>;
  if (coupons.length === 0) return <p className="text-sm text-slate-500">No coupons available</p>;

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Available Coupons</div>
      <div className="grid gap-3">
        {coupons.map((coupon) => (
          <button
            key={coupon.id}
            type="button"
            onClick={() => onSelect(coupon.code)}
            className="text-left rounded-2xl border border-slate-200 p-4 bg-white hover:border-brand-primary transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-900">{coupon.code}</div>
              <span className="text-xs uppercase tracking-[0.18em] text-brand-emerald">{coupon.is_active ? "Active" : "Inactive"}</span>
            </div>
            <div className="text-sm text-slate-600">
              {coupon.discount_type === "percent" ? `${coupon.value}% off` : `₹${coupon.value} off`} · Min ₹{coupon.min_order}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
