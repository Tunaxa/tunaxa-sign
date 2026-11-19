import { z } from "zod";

export const ContractStatus = z.enum([
  "DRAFT",
  "PREPARING",
  "SENT",
  "VIEWED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
]);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const ContractSource = z.enum(["MANUAL", "TEMPLATE", "CRM", "API", "IMPORT"]);
export type ContractSource = z.infer<typeof ContractSource>;

export interface Contract {
  id: string;
  organizationId: string;
  title: string;
  status: ContractStatus;
  source: ContractSource;
  templateId?: string;
  currentVersionId?: string;
  createdBy: string;
  expiresAt?: Date;
  createdAt: Date;
  sentAt?: Date;
  viewedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

export interface ContractVersion {
  id: string;
  contractId: string;
  version: number;
  documentId: string;
  sha256: string;
  isCurrent: boolean;
  createdAt: Date;
  createdBy: string;
}

// ─── State Machine ────────────────────────────────────

const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ["PREPARING", "SENT", "CANCELLED"],
  PREPARING: ["SENT", "CANCELLED"],
  SENT: ["VIEWED", "IN_PROGRESS", "DECLINED", "EXPIRED", "CANCELLED"],
  VIEWED: ["IN_PROGRESS", "DECLINED", "EXPIRED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "DECLINED", "CANCELLED"],
  COMPLETED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionContract(
  current: ContractStatus,
  next: ContractStatus
): { valid: boolean; error?: string } {
  if (!canTransition(current, next)) {
    return {
      valid: false,
      error: `Cannot transition from '${current}' to '${next}'`,
    };
  }
  return { valid: true };
}

// ─── Zod Schemas ──────────────────────────────────────

export const CreateContractSchema = z.object({
  title: z.string().min(1).max(255),
  templateId: z.string().optional(),
  source: ContractSource.default("MANUAL"),
  expiresAt: z.coerce.date().optional(),
});

export const UpdateContractSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  expiresAt: z.coerce.date().optional(),
});

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
