import prisma, { type Prisma } from "@axa-sign/database";
import { hashToken, generateToken, generateId, AppError, BadRequestError, NotFoundError, UnauthorizedError, ConflictError, sha256 } from "@axa-sign/shared";
import { applySignatures, validatePdf } from "@axa-sign/pdf";
import { StorageClient, STORAGE_FOLDERS } from "@axa-sign/storage";
import { eventBus } from "@axa-sign/events";
import { AuditService } from "../audit/audit.service";
import {
  queueInvitationEmails,
  recordInvitationAudit,
  type Invitation,
} from "../contracts/contract.service";

const SESSION_EXPIRY_HOURS = 72;
const MAX_SIGN_ATTEMPTS = 3;
const ACTION_PARTICIPANT_TYPES: Array<"SIGNER" | "APPROVER"> = ["SIGNER", "APPROVER"];

const auditService = new AuditService();

class CurrentVersionConflict extends Error {}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const storage = new StorageClient({
  endpoint: process.env.STORAGE_ENDPOINT || "localhost",
  port: Number(process.env.STORAGE_PORT) || 9000,
  bucket: process.env.STORAGE_BUCKET || "axa-sign",
  accessKey: process.env.STORAGE_ACCESS_KEY || "minioadmin",
  secretKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  useSSL: process.env.STORAGE_USE_SSL === "true",
});

export class SigningService {
  private async createSessionRecord(
    participant: { id: string; contractId: string },
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<{ created: boolean; token?: string; expiresAt: Date }> {
    const now = new Date();
    const existing = await client.signingSession.findFirst({
      where: {
        participantId: participant.id,
        completedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return { created: false, expiresAt: existing.expiresAt };
    }

    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    const token = generateToken(32);
    await client.signingSession.create({
      data: {
        participantId: participant.id,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });

    return { created: true, token, expiresAt };
  }

  private async assertSigningTurn(
    client: Prisma.TransactionClient | typeof prisma,
    contractId: string,
    signingOrder: number
  ) {
    const earlierSigner = await client.participant.findFirst({
      where: {
        contractId,
        type: { in: ACTION_PARTICIPANT_TYPES },
        signingOrder: { lt: signingOrder },
        status: { not: "SIGNED" },
      },
      select: { id: true },
    });

    if (earlierSigner) {
      throw new ConflictError("It is not your turn to sign yet");
    }
  }

  async createSession(contractId: string, participantId: string) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, contractId },
      include: { contract: true },
    });

    if (!participant) throw new NotFoundError("Participant", participantId);
    if (participant.contract.status !== "SENT" && participant.contract.status !== "IN_PROGRESS") {
      throw new ConflictError("Contract is not in a signable state");
    }

    const result = await this.createSessionRecord(participant);
    if (!result.created || !result.token) {
      throw new ConflictError("An active signing session already exists");
    }

    return {
      token: result.token,
      signingUrl: `${process.env.SIGNING_URL || "http://localhost:5174"}/session/${result.token}`,
      expiresAt: result.expiresAt,
    };
  }

  async getSession(token: string) {
    const tokenHash = hashToken(token);

    const session = await prisma.signingSession.findFirst({
      where: { tokenHash },
      include: {
        participant: {
          include: {
            contract: {
              include: {
                versions: { orderBy: { version: "desc" }, take: 1 },
                participants: { orderBy: { signingOrder: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundError("Signing session");
    if (new Date() > session.expiresAt) {
      throw new UnauthorizedError("Signing session has expired");
    }

    return session;
  }

  async getDocument(token: string) {
    const tokenHash = hashToken(token);

    const session = await prisma.signingSession.findFirst({
      where: { tokenHash },
      include: {
        participant: { include: { contract: true } },
      },
    });

    if (!session) throw new NotFoundError("Signing session");
    if (new Date() > session.expiresAt) {
      throw new UnauthorizedError("Signing session has expired");
    }

    const version = await prisma.contractVersion.findFirst({
      where: {
        contractId: session.participant.contractId,
        isCurrent: true,
      },
      include: { document: true },
    });

    if (!version?.document) throw new NotFoundError("Document", session.participant.contractId);

    const buffer = await storage.download(version.document.storageKey);

    return {
      buffer,
      document: version.document,
    };
  }

  async authenticate(token: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = hashToken(token);

    const session = await prisma.signingSession.findFirst({
      where: { tokenHash },
      include: { participant: true },
    });

    if (!session) throw new NotFoundError("Signing session");
    if (new Date() > session.expiresAt) {
      throw new UnauthorizedError("Signing session has expired");
    }

    const updated = await prisma.signingSession.update({
      where: { id: session.id },
      data: {
        authenticatedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    await eventBus.emit({
      type: "contract.viewed",
      organizationId: "",
      contractId: session.participant.contractId,
      participantId: session.participantId,
      occurredAt: new Date(),
    });

    return updated;
  }

  async sign(
    token: string,
    signatureData: {
      type: string;
      imageData?: string;
      fieldX?: number;
      fieldY?: number;
      page?: number;
    }
  ) {
    const tokenHash = hashToken(token);

    const session = await prisma.signingSession.findFirst({
      where: { tokenHash },
      include: {
        participant: {
          include: { contract: { include: { creator: true } } },
        },
      },
    });

    if (!session) throw new NotFoundError("Signing session");
    if (!session.authenticatedAt) {
      throw new UnauthorizedError("Session not authenticated");
    }
    if (session.participant.status === "SIGNED") {
      throw new ConflictError("Participant has already signed");
    }
    if (signatureData.fieldX === undefined || signatureData.fieldY === undefined) {
      throw new BadRequestError("fieldX and fieldY are required to sign a PDF");
    }

    await this.assertSigningTurn(
      prisma,
      session.participant.contractId,
      session.participant.signingOrder
    );

    const { contract, id: participantId, name: signerName } = session.participant;
    let conflictAttempts = 0;

    while (conflictAttempts < MAX_SIGN_ATTEMPTS) {
      const baseVersion = await prisma.contractVersion.findFirst({
        where: { contractId: contract.id, isCurrent: true },
        include: { document: true },
      });

      if (!baseVersion?.document) {
        throw new NotFoundError("Document", contract.id);
      }

      let baseBytes: Buffer;
      try {
        baseBytes = await storage.download(baseVersion.document.storageKey);
      } catch (error) {
        throw new AppError(
          `Unable to read the current document: ${errorMessage(error)}`,
          "DOCUMENT_READ_FAILED",
          500
        );
      }
      const documentHashBefore = sha256(baseBytes);

      const pdfCheck = await validatePdf(baseBytes);
      if (!pdfCheck.valid) {
        throw new AppError(
          `PDF is unreadable: ${pdfCheck.error || "invalid PDF"}`,
          "UNREADABLE_PDF",
          422
        );
      }

      let sealed: Awaited<ReturnType<typeof applySignatures>>;
      try {
        sealed = await applySignatures(baseBytes, [
          {
            page: signatureData.page || 1,
            x: signatureData.fieldX,
            y: signatureData.fieldY,
            width: 160,
            height: 50,
            name: signerName,
            date: new Date(),
            imageData: signatureData.imageData,
          },
        ]);
      } catch (error) {
        throw new AppError(
          `Failed to seal PDF: ${errorMessage(error)}`,
          "PDF_SEAL_FAILED",
          500
        );
      }

      const nextVersionNumber = baseVersion.version + 1;
      const signedKey = `${STORAGE_FOLDERS.SIGNED}/${contract.organizationId}/${contract.id}/v${nextVersionNumber}-signed-${generateId()}.pdf`;
      try {
        await storage.upload(signedKey, sealed.buffer, "application/pdf");
      } catch (error) {
        await storage.delete(signedKey).catch(() => undefined);
        throw new AppError(
          `Failed to store signed PDF: ${errorMessage(error)}`,
          "SIGNED_PDF_UPLOAD_FAILED",
          500
        );
      }

      try {
        const committed = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "contracts" WHERE id = ${contract.id} FOR UPDATE`;
          if (locked.length !== 1) throw new NotFoundError("Contract", contract.id);

          const current = await tx.contract.findUniqueOrThrow({
            where: { id: contract.id },
            select: { currentVersionId: true },
          });
          if (current.currentVersionId !== baseVersion.id) {
            throw new CurrentVersionConflict();
          }

          const participant = await tx.participant.findUniqueOrThrow({
            where: { id: participantId },
            select: { status: true },
          });
          if (participant.status === "SIGNED") {
            throw new ConflictError("Participant has already signed");
          }

          await this.assertSigningTurn(tx, contract.id, session.participant.signingOrder);

          const latest = await tx.contractVersion.findFirst({
            where: { contractId: contract.id },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const versionNumber = (latest?.version ?? 0) + 1;
          if (versionNumber !== nextVersionNumber) {
            throw new CurrentVersionConflict();
          }

          const signature = await tx.signature.create({
            data: {
              contractId: contract.id,
              participantId,
              type: signatureData.type as any,
              imageData: signatureData.imageData,
              fieldX: signatureData.fieldX,
              fieldY: signatureData.fieldY,
              page: signatureData.page,
            },
          });

          const signedDocument = await tx.document.create({
            data: {
              name: `${contract.title} - signed.pdf`,
              mimeType: "application/pdf",
              size: sealed.buffer.length,
              sha256: sealed.sha256After,
              storageKey: signedKey,
              organizationId: contract.organizationId,
            },
          });

          await tx.contractVersion.updateMany({
            where: { contractId: contract.id, isCurrent: true },
            data: { isCurrent: false },
          });

          const version = await tx.contractVersion.create({
            data: {
              contractId: contract.id,
              version: versionNumber,
              documentId: signedDocument.id,
              sha256: sealed.sha256After,
              isCurrent: true,
              createdBy: participantId,
            },
          });

          await tx.contract.update({
            where: { id: contract.id },
            data: { currentVersionId: version.id },
          });

          await tx.signatureEvidence.create({
            data: {
              signatureId: signature.id,
              documentHashBefore,
              documentHashAfter: sealed.sha256After,
              authenticationMethod: "session-token",
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
            },
          });

          await tx.participant.update({
            where: { id: participantId },
            data: { status: "SIGNED", signedAt: new Date() },
          });

          await tx.signingSession.update({
            where: { id: session.id },
            data: { completedAt: new Date() },
          });

          const currentGroup = await tx.participant.findMany({
            where: {
              contractId: contract.id,
              type: { in: ACTION_PARTICIPANT_TYPES },
              signingOrder: session.participant.signingOrder,
            },
            select: { status: true },
          });
          const groupComplete = currentGroup.every(
            (candidate) => candidate.status === "SIGNED"
          );

          const invitations: Invitation[] = [];
          if (groupComplete) {
            const nextOrder = await tx.participant.findFirst({
              where: {
                contractId: contract.id,
                type: { in: ACTION_PARTICIPANT_TYPES },
                signingOrder: { gt: session.participant.signingOrder },
              },
              orderBy: { signingOrder: "asc" },
              select: { signingOrder: true },
            });

            if (nextOrder) {
              const nextGroup = await tx.participant.findMany({
                where: {
                  contractId: contract.id,
                  type: { in: ACTION_PARTICIPANT_TYPES },
                  signingOrder: nextOrder.signingOrder,
                },
                orderBy: { id: "asc" },
              });

              for (const participant of nextGroup) {
                const result = await this.createSessionRecord(participant, tx);
                if (result.created && result.token) {
                  invitations.push({
                    participant,
                    token: result.token,
                    expiresAt: result.expiresAt,
                  });
                }
              }
            }
          }

          return { signature, version, invitations };
        });

        const invitations = committed.invitations;
        await queueInvitationEmails(invitations, {
          organizationId: contract.organizationId,
          contractId: contract.id,
          contractTitle: contract.title,
          senderName: `${contract.creator.firstName} ${contract.creator.lastName}`,
        });
        await recordInvitationAudit(invitations, {
          organizationId: contract.organizationId,
          contractId: contract.id,
        });

        await eventBus.emit({
          type: "participant.signed",
          organizationId: contract.organizationId,
          contractId: contract.id,
          participantId,
          occurredAt: new Date(),
        });

        await this.maybeCompleteContract(contract.id, contract.organizationId);

        return committed.signature;
      } catch (error) {
        await storage.delete(signedKey).catch(() => undefined);
        if (error instanceof CurrentVersionConflict) {
          conflictAttempts += 1;
          continue;
        }
        throw error;
      }
    }

    throw new ConflictError("Concurrent signing conflict; please retry");
  }

  private async maybeCompleteContract(contractId: string, organizationId: string) {
    const claimed = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "contracts" WHERE id = ${contractId} FOR UPDATE`;
      if (locked.length !== 1) return false;

      const contract = await tx.contract.findUniqueOrThrow({
        where: { id: contractId },
        select: { status: true },
      });
      if (contract.status === "COMPLETED") return false;

      const [pending, total] = await Promise.all([
        tx.participant.count({
          where: {
            contractId,
            type: { in: ACTION_PARTICIPANT_TYPES },
            status: { not: "SIGNED" },
          },
        }),
        tx.participant.count({
          where: {
            contractId,
            type: { in: ACTION_PARTICIPANT_TYPES },
          },
        }),
      ]);

      if (total === 0 || pending !== 0) return false;

      const updated = await tx.contract.updateMany({
        where: { id: contractId, status: { not: "COMPLETED" } },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (updated.count !== 1) return false;

      await tx.signingStep.updateMany({
        where: { contractId, status: "WAITING" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      return true;
    });

    if (!claimed) return;

    await eventBus.emit({
      type: "contract.completed",
      organizationId,
      contractId,
      participantIds: [],
      documentId: "",
      occurredAt: new Date(),
    });
  }
}
