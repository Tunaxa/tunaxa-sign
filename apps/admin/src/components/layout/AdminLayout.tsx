import { Link, useLocation, Outlet } from "react-router-dom";
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a22]">
      {/* Sidebar */}
      <aside className="w-60 bg-[#121228] border-r border-white/5 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              AXA SIGN <span className="text-blue-400">ADMIN</span>
            </h1>
            <p className="text-xs text-gray-500">Platform Control Center</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )}
              >
                <item.icon size={16} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
            <ShieldAlert size={14} />
            Restricted: Platform Admins Only
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}