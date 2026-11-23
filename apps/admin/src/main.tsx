import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAdminAuth } from "./stores/auth";
import { setAdminToken } from "./lib/api";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AdminLoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { OrganizationsPage } from "./pages/OrganizationsPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { QueuesPage } from "./pages/QueuesPage";
import { HealthPage } from "./pages/HealthPage";
import { StoragePage } from "./pages/StoragePage";
import { CertificatesPage } from "./pages/CertificatesPage";
import "./index.css";

// Hydrate stored admin token on boot
try {
  const persisted = localStorage.getItem("axa-admin-auth");
  if (persisted) {
    const state = JSON.parse(persisted)?.state;
    if (state?.token) {
      setAdminToken(state.token);
    }
  }
} catch {
  // localStorage unavailable
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const token = useAdminAuth((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/queues" element={<QueuesPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
