import { useAuthStore } from "@/stores/auth";

export function SettingsPage() {
  const { user, organization } = useAuthStore();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Organization */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Organization</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <p className="text-sm text-gray-900 mt-1">{organization?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Slug</label>
              <p className="text-sm text-gray-900 mt-1">{organization?.slug}</p>
            </div>
          </div>
        </div>

        {/* Profile */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <p className="text-sm text-gray-900 mt-1">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <p className="text-sm text-gray-900 mt-1">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Role</label>
              <p className="text-sm text-gray-900 mt-1">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">API Keys</h2>
          <p className="text-sm text-gray-500">
            API key management coming soon
          </p>
        </div>

        {/* Webhooks */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Webhooks</h2>
          <p className="text-sm text-gray-500">
            Webhook configuration coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
