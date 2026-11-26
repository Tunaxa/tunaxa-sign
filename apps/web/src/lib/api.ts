const API_BASE = '/api/v1';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    // Handle 401 — try token refresh once
    if (response.status === 401) {
      const refreshed = await this._tryRefresh();
      if (refreshed) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${this.token}`;
        const retry = await fetch(`${API_BASE}${path}`, {
          method: options.method || 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
        if (retry.ok) return retry.status === 204 ? undefined as T : retry.json();
      }
      // Refresh failed — force logout
      this._forceLogout();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  private async _tryRefresh(): Promise<boolean> {
    try {
      // Read refresh token from localStorage (Zustand persist key)
      const persisted = localStorage.getItem('axa-sign-auth');
      if (!persisted) return false;
      const state = JSON.parse(persisted)?.state;
      const refreshToken = state?.refreshToken;
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      this.setToken(data.accessToken);

      // Update the Zustand persisted state so the new tokens survive a reload
      const updated = JSON.parse(localStorage.getItem('axa-sign-auth') || '{}');
      if (updated.state) {
        updated.state.accessToken = data.accessToken;
        updated.state.refreshToken = data.refreshToken;
        localStorage.setItem('axa-sign-auth', JSON.stringify(updated));
      }
      return true;
    } catch {
      return false;
    }
  }

  private _forceLogout() {
    this.token = null;
    localStorage.removeItem('axa-sign-auth');
    window.location.href = '/login';
  }

  get<T>(path: string, signal?: AbortSignal) {
    return this.request<T>(path, { signal });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  upload<T>(
    path: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}${path}`);

      if (this.token) {
        xhr.setRequestHeader("Authorization", `Bearer ${this.token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status === 401) {
          const refreshed = await this._tryRefresh();
          if (refreshed) {
            try {
              const res = await this.upload<T>(path, formData, onProgress);
              resolve(res);
              return;
            } catch (err) {
              reject(err);
              return;
            }
          }
          this._forceLogout();
          reject(new Error("Session expired. Please sign in again."));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
            resolve(data as T);
          } catch {
            resolve(undefined as T);
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || err.message || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during file upload"));
      };

      xhr.send(formData);
    });
  }
}

export const api = new ApiClient();

// ─── Token re-hydration ───────────────────────────────────────────────────────
// Zustand persist hydrates asynchronously. Without this block the first API
// call after a hard refresh goes out without a token (race condition).
// We eagerly read the access token from localStorage so `api.token` is set
// synchronously at module load time, before any component mounts.
try {
  const persisted = localStorage.getItem('axa-sign-auth');
  if (persisted) {
    const state = JSON.parse(persisted)?.state;
    if (state?.accessToken) {
      api.setToken(state.accessToken);
    }
  }
} catch {
  // localStorage not available (SSR, sandboxed iframe, etc.)
}
