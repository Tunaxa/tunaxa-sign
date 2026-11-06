import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./components/layout/AdminLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { OrganizationsPage } from "./pages/OrganizationsPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { QueuesPage } from "./pages/QueuesPage";
import { HealthPage } from "./pages/HealthPage";
import { StoragePage } from "./pages/StoragePage";
import { CertificatesPage } from "./pages/CertificatesPage";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/queues" element={<QueuesPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);