import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/cn";
import {
  FileText,
  LayoutTemplate,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Contracts", href: "/contracts", icon: FileText },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, organization, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-brand-500 text-white transition-transform lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-lg font-bold tracking-tight">AXA SIGN</h1>
              <p className="text-xs text-brand-200">by Tunaxa</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-brand-200 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Organization */}
          <div className="border-t border-brand-600 px-6 py-4">
            <p className="text-sm font-medium truncate">{organization?.name}</p>
            <p className="text-xs text-brand-200 truncate">{user?.email}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-600 text-white"
                      : "text-brand-200 hover:bg-brand-600 hover:text-white"
                  )}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="border-t border-brand-600 p-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-200 hover:bg-brand-600 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b bg-white px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            {user?.firstName} {user?.lastName}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
