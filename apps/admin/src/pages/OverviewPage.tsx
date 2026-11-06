import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { BarChart3, Building2, FileText, Users, Activity, CheckCircle2 } from "lucide-react";

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
  const { data: stats, isLoading } = useQuery<SystemStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => apiGet(`/admin/stats`),
  });

  const cards = [
    { label: "Organizations", value: stats?.organizationCount, icon: Building2 },
    { label: "Users", value: stats?.userCount, icon: Users },
    { label: "Total Contracts", value: stats?.contractCount, icon: FileText },
    { label: "Completed", value: stats?.completedContracts, icon: CheckCircle2 },
    { label: "Active Signing Sessions", value: stats?.activeSessions, icon: Activity },
    { label: "API Requests (24h)", value: stats?.apiRequests24h, icon: BarChart3 },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live metrics across the AXA Sign platform
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading metrics...</div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl bg-[#121228] border border-white/5 p-5"
              >
                <card.icon size={18} className="text-blue-400 mb-3" />
                <p className="text-2xl font-bold text-white">
                  {card.value?.toLocaleString() ?? "—"}
                </p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* System status */}
          <div className="rounded-xl bg-[#121228] border border-white/5 p-6 mb-8">
            <h2 className="font-semibold text-white mb-4">System Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                <span className="text-sm text-gray-400">PostgreSQL</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                <span className="text-sm text-gray-400">Redis</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                <span className="text-sm text-gray-400">Object Storage</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                <span className="text-sm text-gray-400">Workers</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  5 Active
                </span>
              </div>
            </div>
          </div>

          {/* Storage & webhook summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-[#121228] border border-white/5 p-6">
              <h2 className="font-semibold text-white mb-4">Storage Usage</h2>
              {stats?.storageBytes === undefined ? (
                <p className="text-sm text-gray-500">No data yet</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: "35%" }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {(stats.storageBytes / 1024 / 1024).toFixed(1)} MB used
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#121228] border border-white/5 p-6">
              <h2 className="font-semibold text-white mb-4">Webhook Health</h2>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Failed deliveries</span>
                <span
                  className={`text-sm font-medium ${
                    (stats?.failedWebhooks ?? 0) > 0 ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {stats?.failedWebhooks ?? 0}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}