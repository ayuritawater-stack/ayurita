import { createContext, useContext, useEffect, useState } from "react";

const WishlistContext = createContext(null);
const KEY = "ayurita_wishlist_v1";

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const has = (id) => items.some((i) => i.product_id === id);
  const toggle = (product) => {
    setItems((prev) => {
      if (prev.some((i) => i.product_id === product.id)) {
        return prev.filter((i) => i.product_id !== product.id);
      }
      return [
        ...prev,
        {
          product_id: product.id, name: product.name, slug: product.slug, size: product.size,
          price: product.price, bulk_price: product.bulk_price, moq: product.moq,
          image: product.images?.[0], category_name: product.category_name,
        },
      ];
    });
  };
  const remove = (id) => setItems((prev) => prev.filter((i) => i.product_id !== id));
  const clear = () => setItems([]);
  const count = items.length;

  return (
    <WishlistContext.Provider value={{ items, has, toggle, remove, clear, count }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
