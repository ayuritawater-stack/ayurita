import { createContext, useContext, useEffect, useState } from "react";
import { effectivePrice } from "@/lib/pricing";

const CartContext = createContext(null);
const STORAGE_KEY = "ayurita_cart_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          slug: product.slug,
          size: product.size,
          price: product.price,
          bulk_price: product.bulk_price,
          sale_price: product.sale_price,
          sale_starts_at: product.sale_starts_at,
          sale_ends_at: product.sale_ends_at,
          gst_rate: product.gst_rate,
          moq: product.moq,
          image: product.images?.[0],
          quantity,
        },
      ];
    });
  };

  const removeItem = (product_id) =>
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));

  const updateQty = (product_id, quantity) =>
    setItems((prev) =>
      prev.map((i) => (i.product_id === product_id ? { ...i, quantity: Math.max(1, quantity) } : i)),
    );

  const clear = () => setItems([]);

  const subtotal = items.reduce((s, i) => s + effectivePrice(i, i.quantity) * i.quantity, 0);

  // Split each line's GST in half (CGST + SGST), same convention as the backend for an
  // intra-state sale - see backend/routers/orders.py::_compute_totals.
  const { cgst, sgst } = items.reduce(
    (acc, i) => {
      const lineGst = effectivePrice(i, i.quantity) * i.quantity * ((i.gst_rate ?? 18) / 100);
      acc.cgst += lineGst / 2;
      acc.sgst += lineGst / 2;
      return acc;
    },
    { cgst: 0, sgst: 0 },
  );

  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clear, subtotal, cgst, sgst, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
