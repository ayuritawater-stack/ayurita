import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const EMPTY = {
  business_name: "",
  tagline: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  gstin: "",
  business_hours: "",
  upi_id: "",
  payment_details: "",
  tax_rate: 0,
  shipping_flat: 0,
  free_shipping_above: 0,
  low_stock_threshold: 10,
  credit_due_days: 30,
  large_order_threshold: 20000,
  return_window_days: 2,
  credit_reminder_lead_days: 3,
};

const errorMessage = (err, fallback) => {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => d?.msg || d?.type).filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }
  return fallback;
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/settings");
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, settings[key]])),
        tax_rate: Number(settings.tax_rate || 0),
        shipping_flat: Number(settings.shipping_flat || 0),
        free_shipping_above: Number(settings.free_shipping_above || 0),
        low_stock_threshold: Number(settings.low_stock_threshold || 0),
        credit_due_days: Number(settings.credit_due_days || 30),
        large_order_threshold: Number(settings.large_order_threshold || 0),
        return_window_days: Number(settings.return_window_days || 0),
        credit_reminder_lead_days: Number(settings.credit_reminder_lead_days || 0),
      };
      await api.put("/admin/settings", payload);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Settings</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Business & Payments</h1>
        </div>
        <button onClick={save} className="btn-primary" disabled={saving || loading}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          <section className="card-premium p-6">
            <div className="font-semibold text-slate-900 mb-5">Business</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Business Name</Label>
                <Input value={settings.business_name} onChange={(e) => setField("business_name", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Tagline</Label>
                <Input value={settings.tagline} onChange={(e) => setField("tagline", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <Textarea value={settings.address} onChange={(e) => setField("address", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={settings.phone} onChange={(e) => setField("phone", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>WhatsApp (no +)</Label>
                <Input value={settings.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={settings.email} onChange={(e) => setField("email", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>GSTIN</Label>
                <Input value={settings.gstin} onChange={(e) => setField("gstin", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <Label>Business Hours</Label>
                <Input value={settings.business_hours} onChange={(e) => setField("business_hours", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>
          </section>

          <section className="card-premium p-6">
            <div className="font-semibold text-slate-900 mb-5">Payments</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>UPI ID</Label>
                <Input value={settings.upi_id} onChange={(e) => setField("upi_id", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <Label>Bank Transfer / Payment Details</Label>
                <Textarea value={settings.payment_details} onChange={(e) => setField("payment_details", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>
          </section>

          <section className="card-premium p-6">
            <div className="font-semibold text-slate-900 mb-5">Shipping & Tax</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={settings.tax_rate} onChange={(e) => setField("tax_rate", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Shipping (Flat)</Label>
                <Input type="number" value={settings.shipping_flat} onChange={(e) => setField("shipping_flat", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Free Shipping Above</Label>
                <Input type="number" value={settings.free_shipping_above} onChange={(e) => setField("free_shipping_above", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>
          </section>

          <section className="card-premium p-6">
            <div className="font-semibold text-slate-900 mb-5">Inventory</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Low Stock Threshold</Label>
                <Input type="number" value={settings.low_stock_threshold} onChange={(e) => setField("low_stock_threshold", e.target.value)} className="mt-1.5 rounded-xl" />
                <p className="text-xs text-slate-500 mt-1">Products at or below this stock count are flagged on the dashboard.</p>
              </div>
            </div>
          </section>

          <section className="card-premium p-6">
            <div className="font-semibold text-slate-900 mb-5">Wholesale Credit & Order Review</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Credit Due (Days)</Label>
                <Input type="number" value={settings.credit_due_days} onChange={(e) => setField("credit_due_days", e.target.value)} className="mt-1.5 rounded-xl" />
                <p className="text-xs text-slate-500 mt-1">How many days a customer has to pay off a "Bill to Credit" order.</p>
              </div>
              <div>
                <Label>Large Order Threshold (₹)</Label>
                <Input type="number" value={settings.large_order_threshold} onChange={(e) => setField("large_order_threshold", e.target.value)} className="mt-1.5 rounded-xl" />
                <p className="text-xs text-slate-500 mt-1">Orders at or above this value are flagged "Needs Review" in the order list.</p>
              </div>
              <div>
                <Label>Return Window (Days)</Label>
                <Input type="number" value={settings.return_window_days} onChange={(e) => setField("return_window_days", e.target.value)} className="mt-1.5 rounded-xl" />
                <p className="text-xs text-slate-500 mt-1">How many days after delivery a customer can request a return.</p>
              </div>
              <div>
                <Label>Reminder Lead Time (Days)</Label>
                <Input type="number" value={settings.credit_reminder_lead_days} onChange={(e) => setField("credit_reminder_lead_days", e.target.value)} className="mt-1.5 rounded-xl" />
                <p className="text-xs text-slate-500 mt-1">Start sending WhatsApp payment reminders this many days before a credit order's due date.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
