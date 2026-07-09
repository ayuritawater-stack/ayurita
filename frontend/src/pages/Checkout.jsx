import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { api, formatINR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Checkout() {
  const nav = useNavigate();
  const { items, subtotal, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [form, setForm] = useState({
    business_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    city: "Begusarai",
    gst_number: "",
    notes: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const applyCoupon = async () => {
    if (!coupon) return;
    try {
      const { data } = await api.get(`/coupons/validate/${coupon.trim()}`, { params: { subtotal } });
      setCouponData(data);
      toast.success(`Coupon applied — ${data.discount_type === "percent" ? `${data.value}% off` : `${formatINR(data.value)} off`}`);
    } catch (e) {
      setCouponData(null);
      toast.error(e.response?.data?.detail || "Invalid coupon");
    }
  };

  const discount = couponData ? (couponData.discount_type === "percent" ? subtotal * (couponData.value / 100) : couponData.value) : 0;
  const gst = (subtotal - discount) * 0.18;
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal - discount + gst + shipping;

  const placeOrder = async (e) => {
    e.preventDefault();
    if (items.length === 0) return toast.error("Your cart is empty");
    setSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        guest: form,
        coupon_code: couponData ? couponData.code : null,
        payment_method: "cod",
      };
      const { data } = await api.post("/orders", payload);
      clear();
      toast.success("Order placed successfully!");
      nav(`/order-success/${data.order_number}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container-x py-24 text-center">
        <div className="text-slate-500">Your cart is empty</div>
        <Link to="/products" className="btn-primary mt-6 inline-flex">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <h1 className="h-hero !text-4xl md:!text-5xl">Checkout</h1>
        <p className="text-slate-600 mt-2 mb-10">Complete your order — we'll confirm within 2 hours.</p>

        <form onSubmit={placeOrder} className="grid lg:grid-cols-[1fr_400px] gap-8">
          <div className="space-y-6">
            <div className="card-premium p-6">
              <div className="font-heading font-bold text-lg mb-5">Business Details</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Business Name *</Label>
                  <Input required data-testid="checkout-business" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>Contact Person *</Label>
                  <Input required data-testid="checkout-person" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input required data-testid="checkout-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input required type="email" data-testid="checkout-email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>GST Number</Label>
                  <Input data-testid="checkout-gst" value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input required data-testid="checkout-city" value={form.city} onChange={(e) => set("city", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div className="md:col-span-2">
                  <Label>Delivery Address *</Label>
                  <Textarea required data-testid="checkout-address" value={form.address} onChange={(e) => set("address", e.target.value)} className="mt-1.5 rounded-xl min-h-[80px]" />
                </div>
                <div className="md:col-span-2">
                  <Label>Order Notes</Label>
                  <Textarea data-testid="checkout-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
              </div>
            </div>

            <div className="card-premium p-6">
              <div className="font-heading font-bold text-lg mb-4">Payment Method</div>
              <div className="p-4 rounded-xl border border-brand-primary bg-sky-50 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                <div>
                  <div className="font-semibold text-slate-900">Cash on Delivery / Quote-Based</div>
                  <div className="text-xs text-slate-600">We'll confirm your order and share GST invoice for payment</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="card-premium p-6 h-fit lg:sticky lg:top-24">
            <div className="font-heading font-bold text-lg mb-4">Order Summary</div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map((i) => {
                const price = i.bulk_price && i.quantity >= (i.moq || 1) * 10 ? i.bulk_price : i.price;
                return (
                  <div key={i.product_id} className="flex gap-3 items-center text-sm">
                    <img src={i.image} alt={i.name} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{i.name}</div>
                      <div className="text-xs text-slate-500">{i.quantity} × {formatINR(price)}</div>
                    </div>
                    <div className="font-semibold">{formatINR(price * i.quantity)}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex gap-2">
                <Input placeholder="Coupon code" data-testid="coupon-input" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="rounded-xl" />
                <button type="button" onClick={applyCoupon} className="btn-secondary !py-2.5" data-testid="apply-coupon">Apply</button>
              </div>
              {couponData && <div className="text-xs text-brand-emerald font-semibold mt-2">✓ {couponData.code} applied</div>}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{formatINR(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-brand-emerald"><span>Discount</span><span>-{formatINR(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-600">GST (18%)</span><span>{formatINR(gst)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Shipping</span><span>{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
              <div className="border-t border-slate-100 pt-3 mt-2 flex justify-between items-center">
                <span className="text-slate-900 font-semibold">Grand Total</span>
                <span className="font-heading font-bold text-2xl text-slate-900" data-testid="checkout-total">{formatINR(total)}</span>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-6 disabled:opacity-60" data-testid="place-order-btn">
              {submitting ? "Placing…" : "Place Order"} <ArrowRight className="w-4 h-4" />
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}
