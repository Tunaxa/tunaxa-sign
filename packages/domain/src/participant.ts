import { z } from "zod";

export const ParticipantType = z.enum(["SIGNER", "APPROVER", "CC", "VIEWER"]);
export type ParticipantType = z.infer<typeof ParticipantType>;

export const ParticipantStatus = z.enum([
  "PENDING",
  "SENT",
  "VIEWED",
  "IN_PROGRESS",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
]);
export type ParticipantStatus = z.infer<typeof ParticipantStatus>;

export interface Participant {
  id: string;
  contractId: string;
  type: ParticipantType;
  name: string;
  email: string;
  role?: string;
  signingOrder: number;
  status: ParticipantStatus;
  signedAt?: Date;
  declinedAt?: Date;
  declinedReason?: string;
}

export const AddParticipantSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  type: ParticipantType.default("SIGNER"),
  role: z.string().optional(),
  signingOrder: z.number().int().min(0).default(0),
});

export const UpdateParticipantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  type: ParticipantType.optional(),
  role: z.string().optional(),
  signingOrder: z.number().int().min(0).optional(),
});

export type AddParticipantInput = z.infer<typeof AddParticipantSchema>;
export type UpdateParticipantInput = z.infer<typeof UpdateParticipantSchema>;
