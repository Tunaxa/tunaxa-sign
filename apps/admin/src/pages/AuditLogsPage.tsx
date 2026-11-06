import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface AuditEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  hash: string;
  organizationId: string;
  userId: string | null;
  createdAt: string;
}

export function AuditLogsPage() {
  const { data, isLoading } = useQuery<{ data: AuditEvent[] }>({
    queryKey: ["admin", "audit"],
    queryFn: () => apiGet(`/admin/audit-events`),
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Append-only hash-chained audit trail
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="rounded-xl bg-[#121228] border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Timestamp</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Organization</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.data.map((event) => (
                <tr key={event.id} className="hover:bg-white/5">
                  <td className="px-6 py-3 text-sm text-gray-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-blue-500/10 text-blue-300 px-2.5 py-0.5 text-xs font-medium">
                      {event.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400">
                    {event.userId ? event.userId.slice(0, 8) : "system"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400">
                    {event.organizationId.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs text-gray-600">
                      {event.hash.slice(0, 16)}...
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}