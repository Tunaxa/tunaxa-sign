export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AuthenticatedRequest {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  deliveryId: string;
}

export interface ApiKeyInfo {
  id: string;
  organizationId: string;
  permissions: string[];
}

import { AppError } from "./errors";
