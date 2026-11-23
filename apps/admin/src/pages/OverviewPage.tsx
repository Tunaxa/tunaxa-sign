import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Building2,
  FileText,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HardDrive,
} from "lucide-react";

interface SystemStats {
  organizationCount: number;
  userCount: number;
  contractCount: number;
  completedContracts: number;
  activeSessions: number;
  failedWebhooks: number;
  storageBytes: number;
  apiRequests24h: number;
}

export function OverviewPage() {
  const { data: stats, isLoading, isError } = useQuery<SystemStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => apiGet(`/admin/stats`),
  });

  const cards = [
    { label: "Active Tenants", value: stats?.organizationCount, icon: Building2, color: "text-blue-400" },
    { label: "Registered Users", value: stats?.userCount, icon: Users, color: "text-purple-400" },
    { label: "Total Envelopes", value: stats?.contractCount, icon: FileText, color: "text-indigo-400" },
    { label: "Executed Contracts", value: stats?.completedContracts, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Active Signing Sessions", value: stats?.activeSessions, icon: Activity, color: "text-amber-400" },
    { label: "API Requests (24h)", value: stats?.apiRequests24h, icon: BarChart3, color: "text-cyan-400" },
  ];

  const formatStorageMB = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return "0.0 MB";
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Platform Overview</h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time telemetry and infrastructure health across the AXA Sign cluster
        </p>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <span>Failed to load platform telemetry. Please verify operator API authorization.</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl bg-[#121228] border border-white/5 p-4 flex flex-col justify-between hover:border-white/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-medium">{card.label}</span>
                <Icon size={16} className={card.color} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">
                {isLoading ? (
                  <span className="inline-block h-6 w-12 bg-white/10 rounded animate-pulse" />
                ) : (
                  card.value?.toLocaleString() ?? "0"
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* System Infrastructure Quick Link */}
      <div className="rounded-xl bg-[#121228] border border-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Service Health Diagnostics</h2>
            <p className="text-xs text-slate-400 mt-0.5">Live latency and ping monitoring for database, cache, workers and storage</p>
          </div>
          <Link
            to="/health"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>View Full Diagnostic</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {["PostgreSQL (5435)", "Redis Cache (6379)", "Object Storage (MinIO)", "BullMQ Workers"].map((service) => (
            <div key={service} className="rounded-lg bg-white/5 p-3 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{service}</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Monitored
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage and Webhooks Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage */}
        <div className="rounded-xl bg-[#121228] border border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <HardDrive size={16} className="text-blue-400" />
              S3 / MinIO Storage Footprint
            </h2>
            <Link to="/storage" className="text-xs text-blue-400 hover:text-blue-300">
              Manage Buckets
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Encrypted Storage Used</span>
              <span className="font-semibold text-white">
                {isLoading ? "Loading..." : formatStorageMB(stats?.storageBytes)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{
                  width: stats?.storageBytes
                    ? `${Math.min(100, Math.max(5, (stats.storageBytes / (500 * 1024 * 1024)) * 100))}%`
                    : "0%",
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Includes original PDFs, signed sealed artifacts, and audit trail hash chain records.
            </p>
          </div>
        </div>

        {/* Webhook Delivery Health */}
        <div className="rounded-xl bg-[#121228] border border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Webhook Delivery Health</h2>
            <span className="text-[11px] text-slate-400">Last 24 Hours</span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/5">
            <div>
              <p className="text-xs text-slate-300 font-medium">Failed Dispatches</p>
              <p className="text-[11px] text-slate-500">Unreachable partner endpoint notifications</p>
            </div>
            <span
              className={`text-base font-bold px-3 py-1 rounded-full ${
                (stats?.failedWebhooks ?? 0) > 0
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {isLoading ? "—" : (stats?.failedWebhooks ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
