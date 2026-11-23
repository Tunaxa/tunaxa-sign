import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAdminToken } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AdminAuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_BASE = "/api/v1";

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || "Invalid administrative credentials");
        }

        const data = await res.json();
        const role = data.user?.role;
        // Verify user has elevated administrative privileges
        if (!["OWNER", "ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role)) {
          throw new Error("Access denied: elevated platform permissions required.");
        }

        setAdminToken(data.accessToken);
        set({
          token: data.accessToken,
          user: data.user,
          isAuthenticated: true,
        });
      },

      logout: () => {
        setAdminToken(null);
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: "axa-admin-auth",
    }
  )
);
