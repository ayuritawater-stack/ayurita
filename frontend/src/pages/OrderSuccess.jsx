import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Package, ArrowRight, Home, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { api, API } from "@/lib/api";

export default function OrderSuccess() {
  const { orderNumber } = useParams();
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!orderNumber) return;
    api.get(`/orders/track/${orderNumber}`).then(({ data }) => setOrder(data)).catch(() => {});
  }, [orderNumber]);

  const handleCopy = async () => {
    if (!orderNumber) return;
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      toast.success("Order number copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Unable to copy order number");
    }
  };

  const handleDownloadInvoice = () => {
    if (!orderNumber) return;
    if (order?.status !== "delivered") {
      toast.error("Invoice will be available for download once your order is delivered.");
      return;
    }
    const url = `${API}/orders/${encodeURIComponent(orderNumber)}/invoice.pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="py-24">
      <div className="container-x max-w-xl text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-brand-emerald flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10" strokeWidth={1.5} />
        </div>
        <h1 className="h-section">Order Placed Successfully!</h1>
        <p className="text-slate-600 mt-3">Thank you for your order. Our team will confirm within 2 hours. Your GST invoice will be available for download once the order is delivered.</p>
        <div className="card-premium p-6 mt-8">
          <div className="text-xs uppercase tracking-wider text-slate-500">Your Order Number</div>
          <div className="font-heading font-bold text-3xl text-brand-primary mt-1" data-testid="success-order-number">{orderNumber}</div>
          <div className="text-xs text-slate-500 mt-2">Save this for tracking</div>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button type="button" onClick={handleCopy} className="btn-secondary">
              <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy Order ID"}
            </button>
            <button type="button" onClick={handleDownloadInvoice} className="btn-secondary">
              <Download className="w-4 h-4" /> Download Invoice
            </button>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link to={`/order-tracking/${orderNumber}`} className="btn-primary" data-testid="track-order-cta">
            <Package className="w-4 h-4" /> Track Order
          </Link>
          <Link to="/" className="btn-secondary">
            <Home className="w-4 h-4" /> Back to Home
          </Link>
          <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-primary px-5 py-3">
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
