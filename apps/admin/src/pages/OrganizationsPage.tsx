import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  _count: {
    users: number;
    contracts: number;
    templates: number;
  };
}

export function OrganizationsPage() {
  const { data, isLoading } = useQuery<{ data: Organization[] }>({
    queryKey: ["admin", "organizations"],
    queryFn: () => apiGet(`/admin/organizations`),
  });

  const planColors: Record<string, string> = {
    FREE: "bg-gray-500/20 text-gray-300",
    STARTER: "bg-blue-500/20 text-blue-300",
    BUSINESS: "bg-purple-500/20 text-purple-300",
    ENTERPRISE: "bg-green-500/20 text-green-300",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Organizations</h1>
        <p className="text-sm text-gray-500 mt-1">
          All tenants on the platform
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="rounded-xl bg-[#121228] border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Organization</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Plan</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Users</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Contracts</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Templates</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.data.map((org) => (
                <tr key={org.id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{org.name}</p>
                    <p className="text-xs text-gray-500">{org.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        planColors[org.plan] || "bg-gray-500/20 text-gray-300"
                      }`}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{org._count.users}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{org._count.contracts}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{org._count.templates}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(org.createdAt).toLocaleDateString()}
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