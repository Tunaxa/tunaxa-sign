import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const result = await api.post<{
          user: User;
          organization: Organization;
          accessToken: string;
          refreshToken: string;
        }>("/auth/login", { email, password });

        api.setToken(result.accessToken);
        set({
          user: result.user,
          organization: result.organization,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isAuthenticated: true,
        });
      },

      register: async (data) => {
        const result = await api.post<{
          user: User;
          organization: Organization;
          accessToken: string;
          refreshToken: string;
        }>("/auth/register", data);

        api.setToken(result.accessToken);
        set({
          user: result.user,
          organization: result.organization,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        api.setToken(null);
        set({
          user: null,
          organization: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;

        try {
          const result = await api.post<{
            accessToken: string;
            refreshToken: string;
          }>("/auth/refresh", { refreshToken });

          api.setToken(result.accessToken);
          set({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: "axa-sign-auth",
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
