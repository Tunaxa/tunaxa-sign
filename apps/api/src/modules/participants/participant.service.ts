import prisma from "@axa-sign/database";
import { NotFoundError, ConflictError } from "@axa-sign/shared";
import { type AddParticipantInput, type UpdateParticipantInput } from "@axa-sign/domain";
import { eventBus } from "@axa-sign/events";

export class ParticipantService {
  async add(organizationId: string, contractId: string, input: AddParticipantInput) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
    });
    if (!contract) throw new NotFoundError("Contract", contractId);

    if (contract.status !== "DRAFT") {
      throw new ConflictError("Can only add participants to DRAFT contracts");
    }

    const participant = await prisma.participant.create({
      data: {
        contractId,
        name: input.name,
        email: input.email,
        type: input.type || "SIGNER",
        role: input.role,
        signingOrder: input.signingOrder || 0,
      },
    });

    await eventBus.emit({
      type: "participant.invited",
      organizationId,
      contractId,
      participantId: participant.id,
      email: participant.email,
      occurredAt: new Date(),
    });

    return participant;
  }

  async list(organizationId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
    });
    if (!contract) throw new NotFoundError("Contract", contractId);

    return prisma.participant.findMany({
      where: { contractId },
      orderBy: { signingOrder: "asc" },
      include: { signatures: true },
    });
  }

  async update(organizationId: string, participantId: string, input: UpdateParticipantInput) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, contract: { organizationId } },
      include: { contract: true },
    });
    if (!participant) throw new NotFoundError("Participant", participantId);

    if (participant.contract.status !== "DRAFT") {
      throw new ConflictError("Can only update participants on DRAFT contracts");
    }

    return prisma.participant.update({
      where: { id: participantId },
      data: input,
    });
  }

  async remove(organizationId: string, participantId: string) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, contract: { organizationId } },
      include: { contract: true },
    });
    if (!participant) throw new NotFoundError("Participant", participantId);

    if (participant.contract.status !== "DRAFT") {
      throw new ConflictError("Can only remove participants from DRAFT contracts");
    }

    await prisma.participant.delete({ where: { id: participantId } });
  }

  async remind(organizationId: string, participantId: string) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, contract: { organizationId } },
      include: { contract: true },
    });
    if (!participant) throw new NotFoundError("Participant", participantId);

    // Queue reminder email
    return { sent: true, participantId };
  }
}
