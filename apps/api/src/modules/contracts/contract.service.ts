import prisma from "@axa-sign/database";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  generateToken,
  hashToken,
  paginate,
  paginationMeta,
} from "@axa-sign/shared";
import { transitionContract, type CreateContractInput, type UpdateContractInput } from "@axa-sign/domain";
import { eventBus } from "@axa-sign/events";
import { emailQueue } from "@axa-sign/queue";
import { contractInvitationEmail } from "@axa-sign/notifications";
import { StorageClient } from "@axa-sign/storage";
import { AuditService } from "../audit/audit.service";

const storage = new StorageClient({
  endpoint: process.env.STORAGE_ENDPOINT || "localhost",
  port: Number(process.env.STORAGE_PORT) || 9000,
  bucket: process.env.STORAGE_BUCKET || "axa-sign",
  accessKey: process.env.STORAGE_ACCESS_KEY || "minioadmin",
  secretKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  useSSL: process.env.STORAGE_USE_SSL === "true",
});

const SESSION_EXPIRY_HOURS = 72;

const auditService = new AuditService();

export interface InvitationParticipant {
  id: string;
  name: string;
  email: string;
  type: string;
  signingOrder: number;
}

export interface Invitation {
  participant: InvitationParticipant;
  token: string;
  expiresAt: Date;
}

export function buildInvitations(participants: InvitationParticipant[]): Invitation[] {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  return participants.map((participant) => {
    const token = generateToken(32);
    return { participant, token, expiresAt };
  });
}

export async function queueInvitationEmails(
  invitations: Invitation[],
  context: {
    organizationId: string;
    contractId: string;
    contractTitle: string;
    senderName: string;
  }
): Promise<void> {
  if (invitations.length === 0) return;

  const signingBaseUrl = process.env.SIGNING_URL || "http://localhost:5174";

  try {
    for (const invitation of invitations) {
      const signingUrl = `${signingBaseUrl}/session/${invitation.token}`;
      const { subject, html } = contractInvitationEmail({
        senderName: context.senderName,
        contractTitle: context.contractTitle,
        signingUrl,
        expiresAt: invitation.expiresAt,
      });

      const notification = await prisma.notification.create({
        data: {
          type: "CONTRACT_INVITATION",
          channel: "EMAIL",
          subject,
          body: html.replace(signingUrl, "[signing link]"),
          organizationId: context.organizationId,
          deliveries: {
            create: {
              recipientEmail: invitation.participant.email,
            },
          },
        },
        include: { deliveries: true },
      });

      await emailQueue.add(
        "send",
        {
          to: invitation.participant.email,
          subject,
          html,
          notificationId: notification.deliveries[0].id,
        },
        { attempts: 3 }
      );
    }
  } catch (error) {
    console.error(
      "[ContractService] Failed to queue invitation email:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function recordInvitationAudit(
  invitations: Invitation[],
  context: { organizationId: string; contractId: string }
): Promise<void> {
  for (const invitation of invitations) {
    await auditService.recordEvent({
      type: "participant.invited",
      organizationId: context.organizationId,
      contractId: context.contractId,
      data: {
        participantId: invitation.participant.id,
        signingOrder: invitation.participant.signingOrder,
      },
    });
  }
}

export class ContractService {
  async create(organizationId: string, userId: string, input: CreateContractInput) {
    const contract = await prisma.contract.create({
      data: {
        title: input.title,
        source: input.source || "MANUAL",
        organizationId,
        createdBy: userId,
        expiresAt: input.expiresAt,
        templateId: input.templateId,
      },
    });

    await eventBus.emit({
      type: "contract.created",
      organizationId,
      contractId: contract.id,
      createdBy: userId,
      occurredAt: new Date(),
    });

    return contract;
  }

  async list(organizationId: string, query: { page?: number; limit?: number; status?: string }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);

    const where = { organizationId, ...(query.status ? { status: query.status as any } : {}) };

    const [data, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          participants: { select: { id: true, name: true, email: true, status: true } },
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { versions: true, signatures: true } },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    return { data, pagination: paginationMeta(total, page, limit) };
  }

  async getById(organizationId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
      include: {
        participants: {
          orderBy: { signingOrder: "asc" },
          include: { signatures: true },
        },
        versions: { orderBy: { version: "desc" }, take: 1 },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        template: { select: { id: true, name: true } },
        certificates: true,
      },
    });

    if (!contract) throw new NotFoundError("Contract", contractId);
    return contract;
  }

  async update(organizationId: string, contractId: string, input: UpdateContractInput) {
    const contract = await this.getById(organizationId, contractId);

    if (contract.status !== "DRAFT") {
      throw new ConflictError("Can only update contracts in DRAFT status");
    }

    return prisma.contract.update({
      where: { id: contractId },
      data: input,
    });
  }

  async send(organizationId: string, contractId: string, userId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
      include: {
        participants: true,
        currentVersion: { include: { document: true } },
        creator: true,
      },
    });

    if (!contract) throw new NotFoundError("Contract", contractId);

    if (contract.status !== "DRAFT") {
      throw new ConflictError("Can only send contracts in DRAFT status");
    }

    const transition = transitionContract(contract.status, "SENT");
    if (!transition.valid) throw new ConflictError(transition.error!);

    if (
      !contract.currentVersionId ||
      !contract.currentVersion?.isCurrent ||
      !contract.currentVersion.document
    ) {
      throw new BadRequestError(
        "Contract must have a current document before it can be sent"
      );
    }

    const signers = contract.participants.filter((p) => p.type === "SIGNER");
    if (signers.length === 0) {
      throw new BadRequestError(
        "Contract must have at least one participant with type SIGNER before it can be sent"
      );
    }

    const stepParticipants = contract.participants
      .filter((p) => p.type === "SIGNER" || p.type === "APPROVER")
      .sort(
        (a, b) => a.signingOrder - b.signingOrder || a.id.localeCompare(b.id)
      );
    const firstOrder = stepParticipants[0].signingOrder;
    const firstGroup = stepParticipants.filter(
      (participant) => participant.signingOrder === firstOrder
    );
    const invitations = buildInvitations(firstGroup);

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.contract.updateMany({
        where: { id: contractId, organizationId, status: "DRAFT" },
        data: { status: "SENT", sentAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new ConflictError("Can only send contracts in DRAFT status");
      }

      for (const invitation of invitations) {
        await tx.signingSession.create({
          data: {
            participantId: invitation.participant.id,
            tokenHash: hashToken(invitation.token),
            expiresAt: invitation.expiresAt,
          },
        });
      }

      if (stepParticipants.length > 0) {
        await tx.signingStep.createMany({
          data: stepParticipants.map((participant, index) => ({
            contractId,
            participantId: participant.id,
            step: index + 1,
            type: participant.type === "APPROVER" ? "APPROVE" : "SIGN",
            status: "WAITING",
          })),
        });
      }

      return tx.contract.findUniqueOrThrow({ where: { id: contractId } });
    });

    await auditService.recordEvent({
      type: "contract.sent",
      organizationId,
      contractId,
      userId,
      data: {
        participantIds: contract.participants.map((p) => p.id),
        signerCount: signers.length,
      },
    });

    await queueInvitationEmails(invitations, {
      organizationId,
      contractId,
      contractTitle: contract.title,
      senderName: `${contract.creator.firstName} ${contract.creator.lastName}`,
    });

    await eventBus.emit({
      type: "contract.sent",
      organizationId,
      contractId,
      participantIds: contract.participants.map((p) => p.id),
      occurredAt: new Date(),
    });

    return updated;
  }

  async cancel(organizationId: string, contractId: string, userId: string) {
    const contract = await this.getById(organizationId, contractId);

    const transition = transitionContract(contract.status, "CANCELLED");
    if (!transition.valid) throw new ConflictError(transition.error!);

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await eventBus.emit({
      type: "contract.cancelled",
      organizationId,
      contractId,
      cancelledBy: userId,
      occurredAt: new Date(),
    });

    return updated;
  }

  async complete(organizationId: string, contractId: string) {
    const contract = await this.getById(organizationId, contractId);

    const transition = transitionContract(contract.status, "COMPLETED");
    if (!transition.valid) throw new ConflictError(transition.error!);

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await eventBus.emit({
      type: "contract.completed",
      organizationId,
      contractId,
      participantIds: contract.participants.map((p) => p.id),
      documentId: contract.versions[0]?.documentId || "",
      occurredAt: new Date(),
    });

    return updated;
  }

  async delete(organizationId: string, contractId: string) {
    const contract = await this.getById(organizationId, contractId);

    if (contract.status !== "DRAFT") {
      throw new ConflictError("Can only delete contracts in DRAFT status");
    }

    await prisma.contract.delete({ where: { id: contractId } });
  }

  async download(organizationId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
      select: { title: true, currentVersionId: true },
    });
    if (!contract) throw new NotFoundError("Contract", contractId);
    if (!contract.currentVersionId) {
      throw new NotFoundError("Document for contract", contractId);
    }

    const version = await prisma.contractVersion.findFirst({
      where: { contractId, isCurrent: true },
      include: { document: true },
    });
    if (!version?.document) throw new NotFoundError("Document for contract", contractId);

    const buffer = await storage.download(version.document.storageKey);
    return { buffer, title: contract.title };
  }
}
