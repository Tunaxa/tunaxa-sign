export type DomainEvent =
  | ContractCreatedEvent
  | ContractSentEvent
  | ContractViewedEvent
  | ContractCompletedEvent
  | ContractDeclinedEvent
  | ContractExpiredEvent
  | ContractCancelledEvent
  | DocumentUploadedEvent
  | ParticipantInvitedEvent
  | ParticipantSignedEvent
  | SignatureCreatedEvent
  | CertificateGeneratedEvent;

export interface BaseEvent {
  type: string;
  organizationId: string;
  occurredAt: Date;
}

export interface ContractCreatedEvent extends BaseEvent {
  type: "contract.created";
  contractId: string;
  createdBy: string;
}

export interface ContractSentEvent extends BaseEvent {
  type: "contract.sent";
  contractId: string;
  participantIds: string[];
}

export interface ContractViewedEvent extends BaseEvent {
  type: "contract.viewed";
  contractId: string;
  participantId: string;
}

export interface ContractCompletedEvent extends BaseEvent {
  type: "contract.completed";
  contractId: string;
  participantIds: string[];
  documentId: string;
}

export interface ContractDeclinedEvent extends BaseEvent {
  type: "contract.declined";
  contractId: string;
  participantId: string;
  reason?: string;
}

export interface ContractExpiredEvent extends BaseEvent {
  type: "contract.expired";
  contractId: string;
}

export interface ContractCancelledEvent extends BaseEvent {
  type: "contract.cancelled";
  contractId: string;
  cancelledBy: string;
}

export interface DocumentUploadedEvent extends BaseEvent {
  type: "document.uploaded";
  documentId: string;
  contractId?: string;
}

export interface ParticipantInvitedEvent extends BaseEvent {
  type: "participant.invited";
  contractId: string;
  participantId: string;
  email: string;
}

export interface ParticipantSignedEvent extends BaseEvent {
  type: "participant.signed";
  contractId: string;
  participantId: string;
}

export interface SignatureCreatedEvent extends BaseEvent {
  type: "signature.created";
  contractId: string;
  signatureId: string;
  participantId: string;
}

export interface CertificateGeneratedEvent extends BaseEvent {
  type: "certificate.generated";
  contractId: string;
  certificateId: string;
}

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T
) => Promise<void>;
