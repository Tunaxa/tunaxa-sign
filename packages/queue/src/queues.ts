import { createQueue } from "./connection";
import type {
  DocumentProcessingJob,
  PdfSigningJob,
  EmailJob,
  SmsJob,
  WebhookJob,
  AuditJob,
  CertificateJob,
  CleanupJob,
} from "./types";

export const documentProcessingQueue = createQueue<DocumentProcessingJob>("document-processing");
export const pdfSigningQueue = createQueue<PdfSigningJob>("pdf-signing");
export const emailQueue = createQueue<EmailJob>("email");
export const smsQueue = createQueue<SmsJob>("sms");
export const webhookQueue = createQueue<WebhookJob>("webhooks");
export const auditQueue = createQueue<AuditJob>("audit");
export const certificateQueue = createQueue<CertificateJob>("certificate");
export const cleanupQueue = createQueue<CleanupJob>("cleanup");
