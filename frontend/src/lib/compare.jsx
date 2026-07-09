import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

const CompareContext = createContext(null);
const KEY = "ayurita_compare_v1";
const MAX = 4;

export function CompareProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const has = (id) => items.some((i) => i.id === id);
  const toggle = (product) => {
    if (has(product.id)) {
      setItems((prev) => prev.filter((i) => i.id !== product.id));
      return;
    }
    if (items.length >= MAX) {
      toast.error(`You can compare up to ${MAX} products at a time`);
      return;
    }
    setItems((prev) => [...prev, {
      id: product.id, name: product.name, slug: product.slug, size: product.size,
      price: product.price, bulk_price: product.bulk_price, moq: product.moq,
      image: product.images?.[0], category_name: product.category_name,
      packaging: product.packaging, stock: product.stock, gst_rate: product.gst_rate,
      description: product.description,
    }]);
  };
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);
  const count = items.length;

  return (
    <CompareContext.Provider value={{ items, has, toggle, remove, clear, count, max: MAX }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
