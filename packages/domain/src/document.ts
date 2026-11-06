import { z } from "zod";

export interface Document {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  storageKey: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersion {
  id: string;
  contractId: string;
  version: number;
  documentId: string;
  sha256: string;
  isCurrent: boolean;
  createdAt: Date;
  createdBy: string;
}

export const UploadDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
