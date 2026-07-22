import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, Wallet } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/settings";
import { api, formatINR } from "@/lib/api";
import { effectivePrice } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CouponDropdown from "@/components/CouponDropdown";

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay script"));
    document.body.appendChild(script);
  });

// FastAPI validation errors arrive as detail: [{ loc: [...], msg, type }, ...] rather than a
// plain string - render the first error's field + message instead of dumping the raw array.
const getErrorMessage = (err, fallback) => {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "Value";
    return `${field}: ${first.msg}`;
  }
  return detail || fallback;
};

export default function Checkout() {
  const nav = useNavigate();
  const { shippingFlat, freeShippingAbove } = useSettings();
  const { items, subtotal, cgst, sgst, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState("cod");
  const [coupon, setCoupon] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [credit, setCredit] = useState({ credit_limit: 0, credit_balance: 0 });
  const [form, setForm] = useState({
    business_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    city: "Begusarai",
    state: "Bihar",
    pincode: "",
    gst_number: "",
    notes: "",
  });
  const [deliveryEstimate, setDeliveryEstimate] = useState(null);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [pincodeValid, setPincodeValid] = useState(null);
  const deliveryBlocked = !!(deliveryEstimate && deliveryEstimate.delivery_allowed === false);
  const cityStateValid = form.city.trim().toLowerCase() === "begusarai" && form.state.trim().toLowerCase() === "bihar";
  const pincodeComplete = form.pincode.length === 6;
  const canPlaceOrder = cityStateValid && pincodeComplete && pincodeValid !== false && !deliveryBlocked;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Pre-fill from the signed-in customer's saved profile (Account page) so returning buyers
  // don't retype their business details every order - still fully editable per order below.
  useEffect(() => {
    api.get("/customer/profile").then(({ data }) => {
      setForm((f) => ({
        ...f,
        business_name: data.business_name || f.business_name,
        contact_person: data.contact_person || f.contact_person,
        phone: data.phone || f.phone,
        email: data.email || f.email,
        address: data.address || f.address,
        city: data.city || f.city,
        gst_number: data.gst_number || f.gst_number,
      }));
      setCredit({ credit_limit: data.credit_limit || 0, credit_balance: data.credit_balance || 0 });
    }).catch(() => {});
    // Saved addresses (Account page) take precedence over the single legacy profile address
    // above, if any exist - the default one is pre-selected but still fully editable per order.
    api.get("/customer/addresses").then(({ data }) => {
      setAddresses(data);
      const def = data.find((a) => a.is_default) || data[0];
      if (def) {
        setSelectedAddressId(def.id);
        setForm((f) => ({ ...f, address: def.address, city: def.city, state: def.state || f.state, pincode: def.pincode || f.pincode, gst_number: def.gst_number || f.gst_number }));
      }
    }).catch(() => {});
  }, []);

  const selectAddress = (id) => {
    setSelectedAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) setForm((f) => ({ ...f, address: a.address, city: a.city, state: a.state || f.state, pincode: a.pincode || f.pincode, gst_number: a.gst_number || f.gst_number }));
  };

  // Live delivery-charge check as the address is filled in, so a customer sees the charge (or
  // the "we don't deliver there" rejection) before submitting, not after. Debounced and
  // best-effort - a failed/slow estimate call must never block the checkout page itself.
  useEffect(() => {
    if (!form.address || !form.city || form.pincode.length !== 6 || !cityStateValid || pincodeValid === false) {
      setDeliveryEstimate(null);
      setCheckingDelivery(false);
      return;
    }
    setCheckingDelivery(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/delivery/estimate", {
          address: form.address, city: form.city, state: form.state, pincode: form.pincode,
        });
        setDeliveryEstimate(data);
      } catch (err) {
        setDeliveryEstimate(null);
      } finally {
        setCheckingDelivery(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [form.address, form.city, form.state, form.pincode, cityStateValid, pincodeValid]);

  // Verify the pincode actually exists AND falls within Begusarai (via India Post lookup on the
  // backend) rather than just checking it's 6 digits - best-effort, fails open if the lookup
  // itself is unavailable (we only have a service area of one city, so any pincode we can't
  // place is treated as out-of-area rather than merely "doesn't exist").
  useEffect(() => {
    if (form.pincode.length !== 6) {
      setPincodeValid(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/pincode/${form.pincode}/verify`);
        if (cancelled) return;
        // When the India Post lookup itself failed, the backend already falls back to a static
        // Begusarai-prefix check (data.valid) rather than blindly passing everything.
        if (!data.checked) { setPincodeValid(data.valid); return; }
        const inBegusarai = data.valid && (data.city || "").trim().toLowerCase().includes("begusarai");
        setPincodeValid(inBegusarai);
      } catch (err) {
        // Couldn't even reach our backend - fall back to the same prefix check client-side.
        if (!cancelled) setPincodeValid(form.pincode.startsWith("851"));
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.pincode]);

  // City/State are free-text but we only serve Begusarai, Bihar - flag a mismatch as soon as the
  // customer leaves the field rather than only failing at submit.
  const checkCityState = () => {
    if (form.city.trim().toLowerCase() !== "begusarai" || form.state.trim().toLowerCase() !== "bihar") {
      toast.error("Delivery is available in Begusarai only");
    }
  };

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

  let discount = 0;
  if (couponData) {
    discount = couponData.discount_type === "percent" ? subtotal * (couponData.value / 100) : couponData.value;
    if (couponData.discount_type === "percent" && couponData.max_discount) {
      discount = Math.min(discount, couponData.max_discount);
    }
  }
  // GST is computed on the full line subtotal, same as backend/routers/orders.py -
  // discount is applied as its own line after, not as a reduction to the taxable amount.
  const shipping = subtotal >= freeShippingAbove
    ? 0
    : (deliveryEstimate && deliveryEstimate.delivery_allowed ? deliveryEstimate.shipping : shippingFlat);
  const total = subtotal - discount + cgst + sgst + (deliveryBlocked ? 0 : shipping);
  const availableCredit = credit.credit_limit - credit.credit_balance;
  const creditCoversOrder = availableCredit >= total;

  const placeOrder = async (e) => {
    e.preventDefault();
    if (items.length === 0) return toast.error("Your cart is empty");
    if (form.city.trim().toLowerCase() !== "begusarai" || form.state.trim().toLowerCase() !== "bihar") {
      return toast.error("Delivery is available in Begusarai only");
    }
    if (!form.pincode || form.pincode.length !== 6) return toast.error("Enter a valid pincode");
    if (pincodeValid === false) return toast.error("Invalid pincode — delivery is available in Begusarai only");
    if (deliveryBlocked) return toast.error(deliveryEstimate.reason || "Delivery is not available at this address");
    setSubmitting(true);

    let normalizedPhone = form.phone.replace(/\D/g, "");
    if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.slice(1);
    if (normalizedPhone.length === 12 && normalizedPhone.startsWith("91")) normalizedPhone = normalizedPhone.slice(2);
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setSubmitting(false);
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }

    try {
      const payload = {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        guest: { ...form, phone: normalizedPhone },
        coupon_code: couponData ? couponData.code : null,
        payment_method: payment,
      };
      const { data } = await api.post("/orders", payload);

      if (payment === "online") {
        await loadRazorpayScript();
        const { data: paymentData } = await api.post("/payment/create-order", { order_id: data.id });

        const rzp = new window.Razorpay({
          key: paymentData.key_id,
          amount: paymentData.amount,
          currency: paymentData.currency,
          name: "Ayurita Packaged Drinking Water",
          description: `Order ${paymentData.razorpay_order_id ? data.order_number : ""}`,
          order_id: paymentData.razorpay_order_id,
          prefill: { name: form.contact_person, email: form.email, contact: form.phone },
          theme: { color: "#0F4C81" },
          modal: {
            ondismiss: () => {
              toast.error("Payment was cancelled");
              setSubmitting(false);
            },
          },
          handler: async (response) => {
            try {
              await api.post("/payment/verify", {
                order_id: data.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              clear();
              toast.success("Payment successful! Order placed.");
              nav(`/order-success/${data.order_number}`);
            } catch (err) {
              toast.error(getErrorMessage(err, "Payment verification failed"));
            } finally {
              setSubmitting(false);
            }
          },
        });
        // From here, submitting stays true until the Razorpay modal's handler/ondismiss
        // resets it - not this function's finally, which has already run by the time the
        // user interacts with the modal.
        rzp.open();
        return;
      }

      clear();
      toast.success("Order placed successfully!");
      nav(`/order-success/${data.order_number}`);
      setSubmitting(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to place order"));
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
                  <Input required data-testid="checkout-city" value={form.city} onChange={(e) => set("city", e.target.value)} onBlur={checkCityState} className="mt-1.5 rounded-xl" aria-invalid={!cityStateValid} />
                  {!cityStateValid && <div className="text-xs text-rose-600 mt-1">Delivery is available in Begusarai only</div>}
                </div>
                <div>
                  <Label>State *</Label>
                  <Input required data-testid="checkout-state" value={form.state} onChange={(e) => set("state", e.target.value)} onBlur={checkCityState} className="mt-1.5 rounded-xl" aria-invalid={!cityStateValid} />
                  {!cityStateValid && <div className="text-xs text-rose-600 mt-1">Delivery is available in Begusarai only</div>}
                </div>
                <div>
                  <Label>Pincode *</Label>
                  <Input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    data-testid="checkout-pincode"
                    value={form.pincode}
                    onChange={(e) => set("pincode", e.target.value.replace(/[^0-9]/g, ""))}
                    className="mt-1.5 rounded-xl"
                    aria-invalid={pincodeValid === false}
                  />
                  {pincodeValid === false && <div className="text-xs text-rose-600 mt-1">Invalid pincode — delivery is available in Begusarai only</div>}
                </div>
                {addresses.length > 0 && (
                  <div className="md:col-span-2">
                    <Label>Saved Address</Label>
                    <Select value={selectedAddressId} onValueChange={selectAddress}>
                      <SelectTrigger className="mt-1.5 rounded-xl" data-testid="checkout-address-select">
                        <SelectValue placeholder="Choose a saved address" />
                      </SelectTrigger>
                      <SelectContent>
                        {addresses.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.label} — {a.city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label>Delivery Address *</Label>
                  <Textarea required data-testid="checkout-address" value={form.address} onChange={(e) => set("address", e.target.value)} className="mt-1.5 rounded-xl min-h-[80px]" />
                </div>
                <div className="md:col-span-2">
                  <Label>Order Notes</Label>
                  <Textarea data-testid="checkout-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
              </div>
              {checkingDelivery && <div className="mt-3 text-xs text-slate-500">Checking delivery availability…</div>}
              {deliveryBlocked && <div className="mt-3 text-sm text-rose-600">{deliveryEstimate.reason}</div>}
              {!checkingDelivery && pincodeValid !== false && cityStateValid && deliveryEstimate && deliveryEstimate.delivery_allowed && (
                <div className="mt-3 text-xs text-brand-emerald">
                  Delivery available{deliveryEstimate.distance_km ? ` · ${deliveryEstimate.distance_km} km away` : ""}
                </div>
              )}
            </div>

            <div className="card-premium p-6">
              <div className="font-heading font-bold text-lg mb-4">Payment Method</div>
              <RadioGroup value={payment} onValueChange={setPayment} className="grid gap-3">
                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${payment === "cod" ? "border-brand-primary bg-sky-50" : "border-slate-200"}`}>
                  <RadioGroupItem value="cod" id="pm-cod" data-testid="payment-cod" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-brand-primary" /> Cash on Delivery / Quote-Based
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">We'll confirm your order and share GST invoice for payment.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${payment === "online" ? "border-brand-primary bg-sky-50" : "border-slate-200"}`}>
                  <RadioGroupItem value="online" id="pm-online" data-testid="payment-online" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Wallet className="w-4 h-4 text-brand-primary" /> Pay Online (Razorpay)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">Pay securely with UPI, cards, net banking or wallets via Razorpay.</div>
                  </div>
                </label>
                {credit.credit_limit > 0 && (
                  <label className={`flex items-start gap-3 p-4 rounded-xl border transition ${!creditCoversOrder ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${payment === "credit" ? "border-brand-primary bg-sky-50" : "border-slate-200"}`}>
                    <RadioGroupItem value="credit" id="pm-credit" data-testid="payment-credit" className="mt-0.5" disabled={!creditCoversOrder} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Wallet className="w-4 h-4 text-brand-primary" /> Bill to Credit Account
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Available credit: {formatINR(availableCredit)} of {formatINR(credit.credit_limit)}.
                        {!creditCoversOrder && " This order exceeds your available credit."}
                      </div>
                    </div>
                  </label>
                )}
              </RadioGroup>
            </div>
          </div>

          <aside className="card-premium p-6 h-fit lg:sticky lg:top-24">
            <div className="font-heading font-bold text-lg mb-4">Order Summary</div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map((i) => {
                const price = effectivePrice(i, i.quantity);
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
              <div className="mt-4">
                <CouponDropdown onSelect={(code) => { setCoupon(code); }} />
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{formatINR(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-brand-emerald"><span>Discount</span><span>-{formatINR(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-600">CGST</span><span>{formatINR(cgst)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">SGST</span><span>{formatINR(sgst)}</span></div>
              <div className="flex justify-between">
                <span className="text-slate-600">Shipping{deliveryEstimate?.delivery_allowed && deliveryEstimate.distance_km ? ` (${deliveryEstimate.distance_km} km)` : ""}</span>
                <span>{deliveryBlocked ? "—" : (shipping === 0 ? "Free" : formatINR(shipping))}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-2 flex justify-between items-center">
                <span className="text-slate-900 font-semibold">Grand Total</span>
                <span className="font-heading font-bold text-2xl text-slate-900" data-testid="checkout-total">{formatINR(total)}</span>
              </div>
            </div>

            <button type="submit" disabled={submitting || !canPlaceOrder} className="btn-primary w-full mt-6 disabled:opacity-60" data-testid="place-order-btn">
              {submitting ? (payment === "online" ? "Processing payment…" : "Placing…") : payment === "online" ? "Pay Now" : "Place Order"} <ArrowRight className="w-4 h-4" />
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}
