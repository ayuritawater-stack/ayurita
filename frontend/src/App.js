import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/cart";
import { AuthProvider, useAuth } from "@/lib/auth";
import { WishlistProvider } from "@/lib/wishlist";
import { CompareProvider } from "@/lib/compare";
import PublicLayout from "@/components/layout/PublicLayout";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import Categories from "@/pages/Categories";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderTracking from "@/pages/OrderTracking";
import OrderSuccess from "@/pages/OrderSuccess";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import BulkOrder from "@/pages/BulkOrder";
import Wishlist from "@/pages/Wishlist";
import Compare from "@/pages/Compare";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/components/layout/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminBulkInquiries from "@/pages/admin/AdminBulkInquiries";
import AdminContactMessages from "@/pages/admin/AdminContactMessages";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminCategories from "@/pages/admin/AdminCategories";

function AdminRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CompareProvider>
          <CartProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Toaster position="top-right" richColors closeButton />
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:slug" element={<ProductDetail />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/order-tracking" element={<OrderTracking />} />
                  <Route path="/order-tracking/:orderNumber" element={<OrderTracking />} />
                  <Route path="/order-success/:orderNumber" element={<OrderSuccess />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/bulk-order" element={<BulkOrder />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/compare" element={<Compare />} />
                </Route>

                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="bulk-inquiries" element={<AdminBulkInquiries />} />
                  <Route path="contact-messages" element={<AdminContactMessages />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </CompareProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}

export default App;
