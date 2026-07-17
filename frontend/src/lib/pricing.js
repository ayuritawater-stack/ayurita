// Mirrors backend/routers/orders.py::_flash_sale_active - a product's sale_price only applies
// within its optional sale_starts_at/sale_ends_at window, so the storefront and the order total
// the customer actually pays agree.
export function isFlashSaleActive(product) {
  if (!product || product.sale_price == null) return false;
  const now = Date.now();
  if (product.sale_starts_at && new Date(product.sale_starts_at).getTime() > now) return false;
  if (product.sale_ends_at && new Date(product.sale_ends_at).getTime() < now) return false;
  return true;
}

export function effectivePrice(product, quantity = 1) {
  if (isFlashSaleActive(product)) return product.sale_price;
  if (product?.bulk_price && quantity >= (product.moq || 1) * 10) return product.bulk_price;
  return product?.price ?? 0;
}
