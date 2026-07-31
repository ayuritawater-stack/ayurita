import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, ShoppingCart, Phone, X, Heart, User, Scale, PackageSearch } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useCompare } from "@/lib/compare";
import { isCustomerLoggedIn } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import Logo from "@/components/Logo";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/bulk-order", label: "Bulk Order" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const BUSINESS = useSettings();
  const { count } = useCart();
  const { count: wlCount } = useWishlist();
  const { count: compareCount } = useCompare();
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
      className={`sticky top-0 z-40 transition-all duration-300 bg-white ${
        scrolled ? "shadow-[0_4px_24px_-8px_rgba(18,59,122,0.12)] border-b border-brand-border" : "border-b border-transparent"
      }`}
      data-testid="site-navbar"
    >
      {/* utility bar */}
      <div className="hidden lg:block bg-brand-bg border-b border-brand-border">
        <div className="container-x flex items-center justify-end gap-6 h-9 text-[12px] font-medium text-brand-secondary">
          <a href={`tel:${BUSINESS.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-primary transition" data-testid="nav-phone">
            <Phone className="w-3.5 h-3.5" strokeWidth={1.8} /> {BUSINESS.phoneDisplay}
          </a>
          <Link to="/order-tracking" className="inline-flex items-center gap-1.5 hover:text-brand-primary transition" data-testid="nav-track-order">
            <PackageSearch className="w-3.5 h-3.5" strokeWidth={1.8} /> Track Order
          </Link>
          <Link to={customerIn ? "/account" : "/signin"} className="inline-flex items-center gap-1.5 hover:text-brand-primary transition" data-testid="nav-account-text">
            <User className="w-3.5 h-3.5" strokeWidth={1.8} /> {customerIn ? "My Account" : "Sign In"}
          </Link>
        </div>
      </div>

      {/* main bar */}
      <div className="container-x flex items-center justify-between h-[76px] md:h-20">
        <Link to="/" className="flex items-center group shrink-0" data-testid="brand-logo">
          <Logo className="text-[28px] md:text-[32px]" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7 mx-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="nav-link"
              data-active={location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Link
            to="/wishlist"
            className="relative w-10 h-10 rounded-full bg-brand-bg hover:bg-[#E6EDF6] hidden sm:flex items-center justify-center transition"
            data-testid="nav-wishlist"
            aria-label="Wishlist"
          >
            <Heart className="w-[18px] h-[18px] text-brand-primary" strokeWidth={1.8} />
            {wlCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-emerald text-white text-[10px] font-bold flex items-center justify-center">
                {wlCount}
              </span>
            )}
          </Link>
          <Link
            to="/compare"
            className="relative w-10 h-10 rounded-full bg-brand-bg hover:bg-[#E6EDF6] hidden sm:flex items-center justify-center transition"
            data-testid="nav-compare"
            aria-label="Compare"
          >
            <Scale className="w-[18px] h-[18px] text-brand-primary" strokeWidth={1.8} />
            {compareCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center">
                {compareCount}
              </span>
            )}
          </Link>
          <Link
            to="/cart"
            className="relative w-10 h-10 rounded-full bg-brand-bg hover:bg-[#E6EDF6] flex items-center justify-center transition"
            data-testid="nav-cart"
          >
            <ShoppingCart className="w-[18px] h-[18px] text-brand-primary" strokeWidth={1.8} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-emerald text-white text-[10px] font-bold flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <Link to="/products" className="hidden md:inline-flex btn-primary !py-2.5 !px-6 ml-1" data-testid="nav-quote">
            <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2.2} /> Buy Now
          </Link>
          <button
            className="lg:hidden w-10 h-10 rounded-full bg-brand-bg flex items-center justify-center"
            onClick={() => setOpen((v) => !v)}
            data-testid="nav-menu-toggle"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5 text-brand-primary" /> : <Menu className="w-5 h-5 text-brand-primary" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-white border-t border-brand-border" data-testid="mobile-nav">
          <div className="container-x py-4 flex flex-col gap-1">
            {[...NAV, { to: "/order-tracking", label: "Track Order" }].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wide ${
                    isActive ? "bg-brand-bg text-brand-primary" : "text-brand-secondary hover:bg-brand-bg"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <a href={`tel:${BUSINESS.phone}`} className="px-4 py-3 rounded-xl text-sm font-semibold text-brand-secondary hover:bg-brand-bg inline-flex items-center gap-2">
              <Phone className="w-4 h-4" strokeWidth={1.8} /> {BUSINESS.phoneDisplay}
            </a>
            <Link to={customerIn ? "/account" : "/signin"} className="px-4 py-3 rounded-xl text-sm font-semibold text-brand-secondary hover:bg-brand-bg inline-flex items-center gap-2">
              <User className="w-4 h-4" strokeWidth={1.8} /> {customerIn ? "My Account" : "Sign In"}
            </Link>
            <Link to="/bulk-order" className="btn-primary mt-2 w-full">
              Request Bulk Quote
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
