export interface DocumentProcessingJob {
  contractId: string;
  documentId: string;
  version: number;
  action: "process" | "render" | "thumbnail";
}

export interface PdfSigningJob {
  contractId: string;
  documentId: string;
  signatureId: string;
  participantId: string;
}

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  notificationId: string;
}

export interface SmsJob {
  to: string;
  message: string;
  notificationId: string;
}

export interface WebhookJob {
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  webhookDeliveryId: string;
}

export interface AuditJob {
  eventId: string;
  organizationId: string;
  contractId?: string;
}

export interface CertificateJob {
  contractId: string;
  signerId: string;
}

export interface CleanupJob {
  type: "expired_sessions" | "old_documents" | "webhook_retries";
  olderThanDays?: number;
}
