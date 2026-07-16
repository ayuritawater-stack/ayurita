import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, Package, FolderTree, MessagesSquare, Mail, TicketPercent, LogOut, Droplets, ExternalLink, UserCircle, Users, Star, Wallet, Undo2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, ownerOnly: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/products", label: "Products", icon: Package, ownerOnly: true },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, ownerOnly: true },
  { to: "/admin/bulk-inquiries", label: "Bulk Inquiries", icon: MessagesSquare },
  { to: "/admin/contact-messages", label: "Contact Messages", icon: Mail },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/returns", label: "Returns & Refunds", icon: Undo2 },
  { to: "/admin/coupons", label: "Coupons", icon: TicketPercent, ownerOnly: true },
  { to: "/admin/customers", label: "Customers & Credit", icon: Wallet, ownerOnly: true },
  { to: "/admin/audit-log", label: "Audit Log", icon: ShieldCheck, ownerOnly: true },
  { to: "/admin/settings", label: "Settings", icon: Droplets, ownerOnly: true },
  { to: "/admin/staff", label: "Staff Accounts", icon: Users, ownerOnly: true },
  { to: "/admin/profile", label: "Profile", icon: UserCircle },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  // Admins created before sub-admin roles existed have no admin_role field - default to owner,
  // matching the backend's require_owner default (see backend/deps.py).
  const isStaff = (admin?.admin_role || "owner") === "staff";
  const visibleNav = NAV.filter((item) => !item.ownerOnly || !isStaff);

  const onLogout = () => {
    logout();
    nav("/admin/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0" data-testid="admin-sidebar">
        <div className="px-6 h-16 flex items-center gap-2 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-heading font-bold text-white">Ayurita</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 -mt-0.5">Admin Console</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                  isActive
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-4 h-4" strokeWidth={1.7} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <Link to="/" target="_blank" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white transition">
            <ExternalLink className="w-3.5 h-3.5" /> View Public Site
          </Link>
          <div className="mt-2 p-3 rounded-xl bg-slate-800 flex items-center gap-3">
            <Link to="/admin/profile" className="flex-1 min-w-0 flex items-center gap-3 group" data-testid="admin-profile-link">
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {admin?.name?.[0] || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate group-hover:underline">{admin?.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{admin?.email}</div>
              </div>
            </Link>
            <button onClick={onLogout} data-testid="admin-logout" className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0" aria-label="Logout">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
