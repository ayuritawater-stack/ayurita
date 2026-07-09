import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, User, Check } from "lucide-react";
import { api } from "@/lib/api";

export default function AdminContactMessages() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/admin/contact-messages");
    setItems(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await api.put(`/admin/contact-messages/${id}/status`, null, { params: { status: "read" } });
    toast.success("Marked as read");
    load();
  };

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Contact Messages</div>
        <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Website Enquiries</h1>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card-premium p-12 text-center text-slate-500">No contact messages yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((m) => (
            <div key={m.id} className="card-premium p-6" data-testid={`msg-${m.id}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`chip capitalize ${m.status === "new" ? "!bg-sky-50 !text-brand-primary" : "!bg-slate-100 !text-slate-500"}`}>{m.status}</span>
                <span className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString("en-IN")}</span>
              </div>
              <div className="font-heading font-semibold text-slate-900 text-lg">{m.subject || "(No subject)"}</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{m.message}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1 text-sm">
                <div className="flex gap-2 items-center"><User className="w-3.5 h-3.5 text-slate-400" /> {m.name}</div>
                <div className="flex gap-2 items-center"><Mail className="w-3.5 h-3.5 text-slate-400" /> <a href={`mailto:${m.email}`} className="hover:text-brand-primary">{m.email}</a></div>
                {m.phone && <div className="flex gap-2 items-center"><Phone className="w-3.5 h-3.5 text-slate-400" /> {m.phone}</div>}
              </div>
              {m.status === "new" && (
                <button onClick={() => markRead(m.id)} className="btn-secondary w-full mt-4" data-testid={`mark-read-${m.id}`}>
                  <Check className="w-4 h-4" /> Mark as Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
