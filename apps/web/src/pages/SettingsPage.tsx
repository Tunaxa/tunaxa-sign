import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { Button, Card, PageHeader, Input } from "@axa-sign/ui";
import {
  Building2,
  User,
  Key,
  Webhook,
  Shield,
  CheckCircle2,
  Copy,
} from "lucide-react";

type SettingsTab = "organization" | "profile" | "api" | "security";

export function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("organization");
  const [copiedKey, setCopiedKey] = useState(false);

  const tabs = [
    { id: "organization" as const, label: "Organization", icon: Building2 },
    { id: "profile" as const, label: "My Profile", icon: User },
    { id: "security" as const, label: "Security & MFA", icon: Shield },
    { id: "api" as const, label: "API & Webhooks", icon: Key },
  ];

  const handleCopyMockKey = () => {
    navigator.clipboard?.writeText("ak_live_tunaxa_92a10bf8876c12e9");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Configure your organization, member permissions, security policies, and integrations."
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Organization */}
      {activeTab === "organization" && (
        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Company Details</h3>
            <p className="text-xs text-slate-500 mb-4">
              Your organization's registered legal identity displayed on signing certificates.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Organization Name"
                value={organization?.name || "Tunaxa Corporation"}
                disabled
              />
              <Input
                label="Organization Slug"
                value={organization?.slug || "tunaxa"}
                disabled
              />
            </div>
          </Card>

          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Subscription & Plan</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enterprise plan tier with unlimited envelopes and eIDAS qualified signatures.
            </p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="space-y-0.5">
                <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                  ENTERPRISE
                </span>
                <p className="text-xs text-slate-600 mt-1">High-volume automated envelope signing included</p>
              </div>
              <Button variant="secondary" size="sm" disabled>
                Manage Plan
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Profile */}
      {activeTab === "profile" && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">User Information</h3>
          <p className="text-xs text-slate-500 mb-4">
            Manage your personal profile and email preferences.
          </p>
          <div className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={user?.firstName || ""} disabled />
              <Input label="Last Name" value={user?.lastName || ""} disabled />
            </div>
            <Input label="Email Address" value={user?.email || ""} disabled />
            <Input label="Role" value={user?.role || "MEMBER"} disabled />
          </div>
        </Card>
      )}

      {/* Tab 3: Security */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Multi-Factor Authentication (MFA)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enforce time-based one-time password (TOTP) verification for all sensitive actions.
            </p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">TOTP Authenticator</p>
                  <p className="text-[11px] text-slate-500">Google Authenticator or 1Password</p>
                </div>
              </div>
              <Button variant="secondary" size="xs">
                Configure
              </Button>
            </div>
          </Card>

          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Password & Session</h3>
            <p className="text-xs text-slate-500 mb-4">
              Regularly rotate your password to protect corporate documents.
            </p>
            <Button variant="secondary" size="sm">
              Change Password
            </Button>
          </Card>
        </div>
      )}

      {/* Tab 4: API & Webhooks */}
      {activeTab === "api" && (
        <div className="space-y-6">
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">API Credentials</h3>
                <p className="text-xs text-slate-500 mt-0.5">Use your secret API key to sign documents programmatically via REST.</p>
              </div>
              <Button variant="secondary" size="xs">
                Roll Key
              </Button>
            </div>

            <div className="rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-200 flex items-center justify-between">
              <span>ak_live_tunaxa_92a10bf8876c12e9</span>
              <button
                type="button"
                onClick={handleCopyMockKey}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
              >
                {copiedKey ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Webhook size={16} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-slate-900">Webhook Endpoints</h3>
              </div>
              <Button variant="primary" size="xs">
                Add Endpoint
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Receive instant JSON payloads when contracts are viewed, signed, declined, or executed.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
