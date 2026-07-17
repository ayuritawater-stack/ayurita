import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";

const WishlistContext = createContext(null);
const KEY = "ayurita_wishlist_v1";

const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

const toItem = (p) => ({
  product_id: p.id, name: p.name, slug: p.slug, size: p.size,
  price: p.price, bulk_price: p.bulk_price, moq: p.moq,
  image: p.images?.[0], category_name: p.category_name,
});

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(readLocal);
  // Once a signed-in customer's wishlist has been fetched, the server is the source of
  // truth and toggles stop writing to the guest localStorage key.
  const syncedRef = useRef(false);

  const hydrateFromIds = useCallback(async (ids) => {
    const results = await Promise.all(
      ids.map((id) => api.get(`/products/${id}`).then((r) => r.data).catch(() => null)),
    );
    setItems(results.filter(Boolean).map(toItem));
  }, []);

  // Folds any product IDs saved as a guest (localStorage) into the signed-in account - the
  // server list is always the union, never a replace - so a wishlist built before logging in
  // survives, then switches `items` over to the account's copy so it carries across
  // devices/browsers from here on. Call this right after sign-in/sign-up.
  const syncAfterLogin = useCallback(async () => {
    const local = readLocal();
    const localIds = local.map((i) => i.product_id);
    try {
      const { data } = localIds.length
        ? await api.post("/customer/wishlist/merge", { product_ids: localIds })
        : await api.get("/customer/wishlist");
      await hydrateFromIds(data.product_ids || []);
      localStorage.removeItem(KEY);
      syncedRef.current = true;
    } catch {
      // Leave local state as-is; a later page load will retry.
    }
  }, [hydrateFromIds]);

  useEffect(() => {
    if (isCustomerLoggedIn()) syncAfterLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncedRef.current && !isCustomerLoggedIn()) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const has = (id) => items.some((i) => i.product_id === id);

  const toggle = (product) => {
    const already = has(product.id);
    setItems((prev) => (already ? prev.filter((i) => i.product_id !== product.id) : [...prev, toItem(product)]));
    if (isCustomerLoggedIn()) {
      (already ? api.delete(`/customer/wishlist/${product.id}`) : api.post(`/customer/wishlist/${product.id}`)).catch(() => {});
    }
  };

  const remove = (id) => {
    setItems((prev) => prev.filter((i) => i.product_id !== id));
    if (isCustomerLoggedIn()) api.delete(`/customer/wishlist/${id}`).catch(() => {});
  };

  const clear = () => {
    setItems([]);
    if (isCustomerLoggedIn()) api.delete("/customer/wishlist").catch(() => {});
  };

  // Called on customer sign-out so the account's wishlist stops showing once logged out, and
  // a fresh guest session starts saving to localStorage again instead of the API.
  const resetOnLogout = useCallback(() => {
    syncedRef.current = false;
    setItems(readLocal());
  }, []);

  const count = items.length;

  return (
    <WishlistContext.Provider value={{ items, has, toggle, remove, clear, count, syncAfterLogin, resetOnLogout }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
