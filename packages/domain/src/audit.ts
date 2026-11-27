import { sha256 } from "@axa-sign/shared";

export interface AuditEventInput {
  type: string;
  data?: Record<string, unknown>;
  organizationId: string;
  contractId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function buildAuditEventData(event: AuditEventInput) {
  return {
    type: event.type,
    data: JSON.parse(JSON.stringify(event.data || {})),
    organizationId: event.organizationId,
    contractId: event.contractId,
    userId: event.userId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
  };
}

export function computeAuditEventHash(
  event: AuditEventInput,
  previousHash?: string | null
): string {
  return sha256(JSON.stringify(buildAuditEventData(event)) + (previousHash || ""));
}

export interface AuditEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  hash: string;
  previousHash?: string;
  ipAddress?: string;
  userAgent?: string;
  organizationId: string;
  contractId?: string;
  userId?: string;
  createdAt: Date;
}

export interface AuditTrail {
  events: AuditEvent[];
  isValid: boolean;
  brokenAt?: number;
}

export function verifyAuditChain(events: AuditEvent[]): AuditTrail {
  for (let i = 1; i < events.length; i++) {
    if (events[i].previousHash !== events[i - 1].hash) {
      return {
        events,
        isValid: false,
        brokenAt: i,
      };
    }
  }
  return { events, isValid: true };
}
