import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface HealthStatus {
  service: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  lastCheck: string;
}

export function HealthPage() {
  const { data, isLoading } = useQuery<{ data: HealthStatus[] }>({
    queryKey: ["admin", "health"],
    queryFn: () => apiGet(`/admin/health`),
    refetchInterval: 30000,
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">System Health</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live service diagnostics (auto-refreshes every 30s)
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.data.map((svc) => (
            <div
              key={svc.service}
              className="rounded-xl bg-[#121228] border border-white/5 p-6 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-white">{svc.service}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {svc.latencyMs}ms · checked {new Date(svc.lastCheck).toLocaleTimeString()}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                  svc.status === "healthy"
                    ? "bg-green-500/10 text-green-400"
                    : svc.status === "degraded"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    svc.status === "healthy"
                      ? "bg-green-400"
                      : svc.status === "degraded"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                  }`}
                />
                {svc.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}