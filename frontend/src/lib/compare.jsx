import { createContext, useContext, useEffect, useState } from "react";

const CompareContext = createContext(null);
const KEY = "ayurita_compare_v1";

export function CompareProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const has = (id) => items.some((item) => item.product_id === id);

  const toggle = (product) => {
    setItems((prev) => {
      if (prev.some((item) => item.product_id === product.id)) {
        return prev.filter((item) => item.product_id !== product.id);
      }
      return [
        ...prev,
        {
          product_id: product.id,
          id: product.id,
          name: product.name,
          slug: product.slug,
          size: product.size,
          price: product.price,
          bulk_price: product.bulk_price,
          moq: product.moq,
          image: product.images?.[0],
          category_name: product.category_name,
        },
      ];
    });
  };

  const remove = (id) => setItems((prev) => prev.filter((item) => item.product_id !== id));
  const clear = () => setItems([]);
  const count = items.length;

  return (
    <CompareContext.Provider value={{ items, has, toggle, remove, clear, count }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
