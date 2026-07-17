import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Package, Edit3, Trash2, Plus, X, Download, Upload, FileSpreadsheet } from "lucide-react";
import { api, formatINR, downloadFile } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const EMPTY = {
  name: "", slug: "", category_id: "", category_name: "", size: "500ml",
  price: 0, bulk_price: 0, moq: 1, stock: 0, unit: "unit", packaging: "",
  description: "", images: [], featured: false, is_active: true, gst_rate: 18,
  sale_price: null, sale_starts_at: null, sale_ends_at: null,
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null); // product or EMPTY
  const [imageInput, setImageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([api.get("/admin/products"), api.get("/categories")]);
    setProducts(p.data);
    setCats(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSave = async () => {
    const payload = {
      ...editing,
      price: Number(editing.price),
      bulk_price: Number(editing.bulk_price) || null,
      moq: Number(editing.moq),
      stock: Number(editing.stock),
      gst_rate: Number(editing.gst_rate),
      sale_price: editing.sale_price ? Number(editing.sale_price) : null,
    };
    if (!payload.slug) payload.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const cat = cats.find((c) => c.id === payload.category_id);
    if (cat) payload.category_name = cat.name;
    try {
      if (editing.id) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await api.delete(`/products/${id}`);
    toast.success("Product deleted");
    load();
  };

  const addImage = () => {
    if (!imageInput.trim()) return;
    setEditing({ ...editing, images: [...(editing.images || []), imageInput.trim()] });
    setImageInput("");
  };

  const exportCsv = () =>
    downloadFile("/products/export", {}, `ayurita-products-${new Date().toISOString().slice(0, 10)}.csv`).catch(() => toast.error("Export failed"));
  const downloadTemplate = () =>
    downloadFile("/products/import/template", {}, "ayurita-products-import-template.csv").catch(() => toast.error("Download failed"));

  const importCsv = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setImporting(true);
    try {
      const { data } = await api.post("/products/import", form);
      setImportResult(data);
      if (data.created || data.updated) toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
      if (data.errors?.length) toast.error(`${data.errors.length} row(s) had errors — see details`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Products</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Product Management</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-secondary" title="Download a blank CSV to fill in">
            <FileSpreadsheet className="w-4 h-4" /> Template
          </button>
          <button onClick={exportCsv} className="btn-secondary" data-testid="export-products">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { importCsv(e.target.files[0]); e.target.value = ""; }}
            data-testid="import-products-input"
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary" disabled={importing} data-testid="import-products-btn">
            <Upload className="w-4 h-4" /> {importing ? "Importing…" : "Import CSV"}
          </button>
          <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary" data-testid="add-product-btn">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {importResult && (
        <div className="card-premium p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-heading font-semibold text-sm text-slate-900">
              Import result: {importResult.created} created, {importResult.updated} updated
              {importResult.errors?.length ? `, ${importResult.errors.length} error(s)` : ""}
            </div>
            <button onClick={() => setImportResult(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {importResult.errors?.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-auto text-xs text-rose-600">
              {importResult.errors.map((e, i) => <div key={i}>Row {e.row}: {e.message}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-6 py-3">Product</th>
              <th className="text-left px-6 py-3">Category</th>
              <th className="text-left px-6 py-3">Size</th>
              <th className="text-left px-6 py-3">Price</th>
              <th className="text-left px-6 py-3">Stock</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">No products yet.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50" data-testid={`product-row-${p.slug}`}>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.images?.[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                    <div>
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-slate-600">{p.category_name}</td>
                <td className="px-6 py-3">{p.size}</td>
                <td className="px-6 py-3">
                  <div className="font-semibold">{formatINR(p.price)}</div>
                  {p.bulk_price && <div className="text-xs text-brand-emerald">{formatINR(p.bulk_price)} bulk</div>}
                </td>
                <td className="px-6 py-3">
                  <span className={p.stock > 0 ? "text-slate-700" : "text-rose-500"}>{p.stock}</span>
                </td>
                <td className="px-6 py-3">
                  <span className={`chip capitalize ${p.is_active ? "!bg-emerald-50 !text-brand-emerald" : "!bg-slate-100 !text-slate-500"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                  {p.featured && <span className="chip !bg-amber-50 !text-amber-600 ml-1">Featured</span>}
                  {p.sale_price != null && <span className="chip !bg-rose-50 !text-rose-600 ml-1">Sale</span>}
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => setEditing({ ...p })} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center" data-testid={`edit-product-${p.slug}`}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(p.id)} className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 inline-flex items-center justify-center ml-1" data-testid={`delete-product-${p.slug}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex" data-testid="product-drawer">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <div className="font-heading font-bold text-lg">{editing.id ? "Edit Product" : "New Product"}</div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5 rounded-xl" data-testid="prod-name" />
              </div>
              <div>
                <Label>Slug (URL) — auto if blank</Label>
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category *</Label>
                  <Select value={editing.category_id} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                    <SelectTrigger className="mt-1.5 rounded-xl" data-testid="prod-cat"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Size *</Label>
                  <Input value={editing.size} onChange={(e) => setEditing({ ...editing, size: e.target.value })} className="mt-1.5 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price (₹) *</Label>
                  <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} className="mt-1.5 rounded-xl" data-testid="prod-price" />
                </div>
                <div>
                  <Label>Bulk Price (₹)</Label>
                  <Input type="number" value={editing.bulk_price || 0} onChange={(e) => setEditing({ ...editing, bulk_price: e.target.value })} className="mt-1.5 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>MOQ</Label>
                  <Input type="number" value={editing.moq} onChange={(e) => setEditing({ ...editing, moq: e.target.value })} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>GST %</Label>
                  <Input type="number" value={editing.gst_rate} onChange={(e) => setEditing({ ...editing, gst_rate: e.target.value })} className="mt-1.5 rounded-xl" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Flash Sale (optional)</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Sale Price (₹)</Label>
                    <Input type="number" value={editing.sale_price ?? ""} onChange={(e) => setEditing({ ...editing, sale_price: e.target.value === "" ? null : e.target.value })} className="mt-1.5 rounded-xl" placeholder="None" />
                  </div>
                  <div>
                    <Label>Starts At</Label>
                    <Input type="datetime-local" value={editing.sale_starts_at ? editing.sale_starts_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, sale_starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1.5 rounded-xl" />
                  </div>
                  <div>
                    <Label>Ends At</Label>
                    <Input type="datetime-local" value={editing.sale_ends_at ? editing.sale_ends_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, sale_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1.5 rounded-xl" />
                  </div>
                </div>
              </div>
              <div>
                <Label>Packaging</Label>
                <Input value={editing.packaging || ""} onChange={(e) => setEditing({ ...editing, packaging: e.target.value })} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5 rounded-xl min-h-[80px]" />
              </div>
              <div>
                <Label>Images (URLs)</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input value={imageInput} onChange={(e) => setImageInput(e.target.value)} placeholder="https://…" className="rounded-xl" />
                  <button type="button" onClick={addImage} className="btn-secondary !py-2 !px-4">Add</button>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {(editing.images || []).map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setEditing({ ...editing, images: editing.images.filter((_, j) => j !== i) })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Switch checked={editing.featured} onCheckedChange={(v) => setEditing({ ...editing, featured: v })} />
                  <span className="text-sm">Featured</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-sm">Active</span>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={onSave} className="btn-primary flex-1" data-testid="save-product">
                  {editing.id ? "Update Product" : "Create Product"}
                </button>
                <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
