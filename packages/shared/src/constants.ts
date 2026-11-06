export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const SIGNING_SESSION_EXPIRY_HOURS = 72;
export const JWT_EXPIRY_MINUTES = 15;
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const API_KEY_LENGTH = 32;
export const MAX_WEBHOOK_RETRIES = 3;
export const WEBHOOK_RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const CONTRACT_EXPIRY_DEFAULT_DAYS = 30;

export const AUDIT_EVENT_TYPES = {
  CONTRACT_CREATED: "contract.created",
  CONTRACT_SENT: "contract.sent",
  CONTRACT_VIEWED: "contract.viewed",
  CONTRACT_COMPLETED: "contract.completed",
  CONTRACT_DECLINED: "contract.declined",
  CONTRACT_EXPIRED: "contract.expired",
  CONTRACT_CANCELLED: "contract.cancelled",
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_PROCESSED: "document.processed",
  SIGNATURE_CREATED: "signature.created",
  SIGNATURE_COMPLETED: "signature.completed",
  AUTHENTICATION_STARTED: "authentication.started",
  AUTHENTICATION_COMPLETED: "authentication.completed",
  PARTICIPANT_INVITED: "participant.invited",
  CERTIFICATE_GENERATED: "certificate.generated",
} as const;
