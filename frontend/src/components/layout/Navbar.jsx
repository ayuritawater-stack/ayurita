import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, ShoppingCart, Phone, Droplets, X, Heart, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { BUSINESS, isCustomerLoggedIn } from "@/lib/api";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/bulk-order", label: "Bulk Order" },
  { to: "/about", label: "About" },
  { to: "/order-tracking", label: "Track Order" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const { count } = useCart();
  const { count: wlCount } = useWishlist();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [customerIn, setCustomerIn] = useState(isCustomerLoggedIn());
  const location = useLocation();

  useEffect(() => setCustomerIn(isCustomerLoggedIn()), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? "bg-white/85 backdrop-blur-xl border-b border-slate-100 shadow-sm" : "bg-white/60 backdrop-blur-md"
      }`}
      data-testid="site-navbar"
    >
      <div className="container-x flex items-center justify-between h-16 md:h-20">
        <Link to="/" className="flex items-center gap-2 group" data-testid="brand-logo">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Droplets className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-bold text-lg text-slate-900">Ayurita</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest -mt-0.5">Pure Water</div>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
                  isActive ? "bg-sky-50 text-brand-primary" : "text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <a
            href={`tel:${BUSINESS.phone}`}
            className="hidden xl:inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-primary transition whitespace-nowrap"
            data-testid="nav-phone"
          >
            <Phone className="w-4 h-4" strokeWidth={1.8} />
            {BUSINESS.phoneDisplay}
          </a>
          <Link
            to={customerIn ? "/account" : "/signin"}
            className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 hidden sm:flex items-center justify-center transition"
            data-testid="nav-account"
            aria-label={customerIn ? "My Account" : "Sign In"}
          >
            <User className="w-5 h-5 text-slate-700" strokeWidth={1.8} />
          </Link>
          <Link
            to="/wishlist"
            className="relative w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 hidden sm:flex items-center justify-center transition"
            data-testid="nav-wishlist"
            aria-label="Wishlist"
          >
            <Heart className="w-5 h-5 text-slate-700" strokeWidth={1.8} />
            {wlCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {wlCount}
              </span>
            )}
          </Link>
          <Link
            to="/cart"
            className="relative w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition"
            data-testid="nav-cart"
          >
            <ShoppingCart className="w-5 h-5 text-slate-700" strokeWidth={1.8} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-emerald text-white text-[10px] font-bold flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <Link to="/bulk-order" className="hidden md:inline-flex btn-primary !py-2.5 !px-5" data-testid="nav-quote">
            Request Quote
          </Link>
          <button
            className="xl:hidden w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center"
            onClick={() => setOpen((v) => !v)}
            data-testid="nav-menu-toggle"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="xl:hidden bg-white border-t border-slate-100" data-testid="mobile-nav">
          <div className="container-x py-4 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl text-sm font-medium ${
                    isActive ? "bg-sky-50 text-brand-primary" : "text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/bulk-order" className="btn-primary mt-2 w-full">
              Request Bulk Quote
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
