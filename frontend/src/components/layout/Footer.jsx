import { Link } from "react-router-dom";
import { Droplets, Phone, Mail, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";
import { useSettings } from "@/lib/settings";

export default function Footer() {
  const BUSINESS = useSettings();
  return (
    <footer className="bg-slate-900 text-slate-300" data-testid="site-footer">
      <div className="container-x py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-bold text-lg text-white">Ayurita</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest -mt-0.5">Pure Water</div>
            </div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Ayurita is a trusted manufacturer & wholesale supplier of premium packaged drinking water. Serving hotels, restaurants, corporates & events across Begusarai District.
          </p>
          <div className="flex gap-3 mt-6">
            <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-brand-primary flex items-center justify-center transition" aria-label="Facebook">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-brand-primary flex items-center justify-center transition" aria-label="Instagram">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-brand-primary flex items-center justify-center transition" aria-label="LinkedIn">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-white mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/products" className="hover:text-white transition">All Products</Link></li>
            <li><Link to="/categories" className="hover:text-white transition">Categories</Link></li>
            <li><Link to="/bulk-order" className="hover:text-white transition">Bulk Order</Link></li>
            <li><Link to="/about" className="hover:text-white transition">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-white transition">Contact</Link></li>
            <li><Link to="/order-tracking" className="hover:text-white transition">Track Order</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-white mb-4 text-sm uppercase tracking-wider">We Serve</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>Hotels & Restaurants</li>
            <li>Corporate Offices</li>
            <li>Hospitals & Clinics</li>
            <li>Marriage Halls & Events</li>
            <li>Retail Distributors</li>
            <li>Custom Branding</li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-white mb-4 text-sm uppercase tracking-wider">Get in Touch</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex gap-3">
              <MapPin className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
              <span>{BUSINESS.address}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
              <a href={`tel:${BUSINESS.phone}`} className="hover:text-white transition">{BUSINESS.phoneDisplay}</a>
            </li>
            <li className="flex gap-3">
              <Mail className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
              <a href={`mailto:${BUSINESS.email}`} className="hover:text-white transition">{BUSINESS.email}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="container-x py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} Ayurita Packaged Drinking Water. All rights reserved.</div>
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-white transition">Terms &amp; Conditions</Link>
            <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <span>Made with care in Begusarai, Bihar</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
