import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  organization: {
    name: string;
  };
}

export function UsersPage() {
  const { data, isLoading } = useQuery<{ data: AdminUser[] }>({
    queryKey: ["admin", "users"],
    queryFn: () => apiGet(`/admin/users`),
  });

  const roleColors: Record<string, string> = {
    OWNER: "bg-green-500/20 text-green-300",
    ADMIN: "bg-blue-500/20 text-blue-300",
    MANAGER: "bg-purple-500/20 text-purple-300",
    MEMBER: "bg-gray-500/20 text-gray-300",
    ACCOUNTANT: "bg-yellow-500/20 text-yellow-300",
    VIEWER: "bg-gray-500/20 text-gray-500",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every account on the platform
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="rounded-xl bg-[#121228] border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Organization</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">MFA</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.data.map((user) => (
                <tr key={user.id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {user.organization?.name}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        roleColors[user.role] || "bg-gray-500/20 text-gray-300"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs ${
                        user.mfaEnabled ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {user.mfaEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "Never"}
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