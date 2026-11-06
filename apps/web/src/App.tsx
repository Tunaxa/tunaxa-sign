import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ContractsPage } from "./pages/ContractsPage";
import { ContractDetailPage } from "./pages/ContractDetailPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { SettingsPage } from "./pages/SettingsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/contracts" replace />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/contracts/:id" element={<ContractDetailPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
