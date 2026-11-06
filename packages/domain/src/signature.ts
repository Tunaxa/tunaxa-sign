import { z } from "zod";

export const SignatureType = z.enum(["DRAWN", "TYPED", "UPLOADED"]);
export type SignatureType = z.infer<typeof SignatureType>;

export interface Signature {
  id: string;
  contractId: string;
  participantId: string;
  type: SignatureType;
  fieldX?: number;
  fieldY?: number;
  fieldWidth?: number;
  fieldHeight?: number;
  page?: number;
  imageData?: string;
  createdAt: Date;
}

export interface SignatureEvidence {
  id: string;
  signatureId: string;
  documentHashBefore: string;
  documentHashAfter: string;
  authenticationMethod: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export const CreateSignatureSchema = z.object({
  type: SignatureType,
  fieldX: z.number().optional(),
  fieldY: z.number().optional(),
  fieldWidth: z.number().optional(),
  fieldHeight: z.number().optional(),
  page: z.number().int().min(1).optional(),
  imageData: z.string().optional(),
});

export type CreateSignatureInput = z.infer<typeof CreateSignatureSchema>;
