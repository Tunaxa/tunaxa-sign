import prisma from "@axa-sign/database";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  generateId,
  paginate,
  paginationMeta,
} from "@axa-sign/shared";
import { transitionContract, type CreateContractInput, type UpdateContractInput } from "@axa-sign/domain";
import { eventBus } from "@axa-sign/events";

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
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { document: true },
        },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        template: { select: { id: true, name: true } },
        certificates: true,
        _count: { select: { versions: true, signatures: true } },
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

  async send(organizationId: string, contractId: string) {
    const contract = await this.getById(organizationId, contractId);

    const transition = transitionContract(contract.status, "SENT");
    if (!transition.valid) throw new ConflictError(transition.error!);

    if (!contract.versions || contract.versions.length === 0) {
      throw new ConflictError("Le contrat ne contient aucun document. Veuillez associer un document PDF avant de l'envoyer.");
    }

    if (contract.participants.length === 0) {
      throw new ConflictError("Le contrat doit comporter au moins un signataire pour être envoyé.");
    }

    const signersOnly = contract.participants.filter(
      (p) => (p.type || "SIGNER") === "SIGNER"
    );
    if (signersOnly.length === 0) {
      throw new ConflictError("Le contrat doit comporter au moins un participant ayant le rôle Signataire (SIGNER) pour être envoyé.");
    }

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { status: "SENT", sentAt: new Date() },
    });

    // Create signing steps for participants who must sign or approve
    const actionableParticipants = contract.participants.filter(
      (p) => p.type === "SIGNER" || p.type === "APPROVER" || !p.type
    );

    await prisma.signingStep.createMany({
      data: actionableParticipants.map((p, i) => ({
        contractId,
        participantId: p.id,
        step: i + 1,
        type: p.type === "APPROVER" ? "APPROVE" : "SIGN",
        status: "WAITING",
      })),
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
}
