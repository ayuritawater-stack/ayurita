import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit3, Trash2, X, FolderTree } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const EMPTY = { name: "", slug: "", description: "", image_url: "" };

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/categories");
    setCats(data);
  };
  useEffect(() => { load(); }, []);

  const onSave = async () => {
    const payload = { ...editing };
    if (!payload.slug) payload.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      if (editing.id) await api.put(`/categories/${editing.id}`, payload);
      else await api.post("/categories", payload);
      toast.success("Category saved");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete category?")) return;
    await api.delete(`/categories/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Categories</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Manage Categories</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary" data-testid="add-category">
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cats.map((c) => (
          <div key={c.id} className="card-premium p-6" data-testid={`cat-${c.slug}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 text-brand-primary flex items-center justify-center">
                <FolderTree className="w-5 h-5" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing({ ...c })} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(c.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="font-heading font-bold text-lg text-slate-900">{c.name}</div>
            <div className="text-xs text-slate-500 mt-1">{c.slug}</div>
            <p className="text-sm text-slate-600 mt-3 line-clamp-3">{c.description}</p>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between">
              <div className="font-heading font-bold">{editing.id ? "Edit Category" : "New Category"}</div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5 rounded-xl" data-testid="cat-name" />
              </div>
              <div>
                <Label>Slug (auto if blank)</Label>
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={onSave} className="btn-primary flex-1" data-testid="save-cat">Save</button>
                <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
