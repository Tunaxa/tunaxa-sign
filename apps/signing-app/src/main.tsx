import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SigningPage } from "./SigningPage";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/session/:token" element={<SigningPage />} />
          <Route path="*" element={<div className="flex items-center justify-center h-screen text-gray-500">Invalid signing link</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
