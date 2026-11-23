import { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "@/stores/auth";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  Building2,
  Users,
  ScrollText,
  Layers,
  HeartPulse,
  Database,
  BadgeCheck,
  ShieldAlert,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/", icon: BarChart3 },
  { name: "Organizations", href: "/organizations", icon: Building2 },
  { name: "Users", href: "/users", icon: Users },
  { name: "Audit Logs", href: "/audit-logs", icon: ScrollText },
  { name: "Queues", href: "/queues", icon: Layers },
  { name: "System Health", href: "/health", icon: HeartPulse },
  { name: "Storage", href: "/storage", icon: Database },
  { name: "Certificates", href: "/certificates", icon: BadgeCheck },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userInitials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "A"
    : "A";

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a22] text-slate-100">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#121228] border-r border-white/5 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              AXA SIGN <span className="text-blue-400 font-normal">ADMIN</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Control Center</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon size={16} className={isActive ? "text-blue-400" : "text-slate-500"} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Operator Profile & Sign Out */}
        <div className="p-3 border-t border-white/5 space-y-2 shrink-0">
          <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-[11px] text-white">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {user ? `${user.firstName} ${user.lastName}` : "Admin"}
                </p>
                <p className="truncate text-[10px] text-blue-400 font-mono">
                  {user?.role || "OPERATOR"}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-[10px]">
            <ShieldAlert size={12} className="text-red-400 shrink-0" />
            <span className="truncate">Restricted Platform Access</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="h-14 flex items-center justify-between border-b border-white/5 px-4 bg-[#121228] lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <span className="text-xs font-bold text-white tracking-wider">PLATFORM CONSOLE</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
