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
