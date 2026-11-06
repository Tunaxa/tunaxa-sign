import prisma from "@axa-sign/database";
import { hashToken, generateToken, generateId, NotFoundError, UnauthorizedError, ConflictError, sha256 } from "@axa-sign/shared";
import { applySignatures } from "@axa-sign/pdf";
import { StorageClient, STORAGE_FOLDERS } from "@axa-sign/storage";
import { eventBus } from "@axa-sign/events";

const SESSION_EXPIRY_HOURS = 72;

const storage = new StorageClient({
  endpoint: process.env.STORAGE_ENDPOINT || "localhost",
  port: Number(process.env.STORAGE_PORT) || 9000,
  bucket: process.env.STORAGE_BUCKET || "axa-sign",
  accessKey: process.env.STORAGE_ACCESS_KEY || "minioadmin",
  secretKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  useSSL: process.env.STORAGE_USE_SSL === "true",
});

export class SigningService {
  async createSession(contractId: string, participantId: string) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, contractId },
      include: { contract: true },
    });

    if (!participant) throw new NotFoundError("Participant", participantId);
    if (participant.contract.status !== "SENT" && participant.contract.status !== "IN_PROGRESS") {
      throw new ConflictError("Contract is not in a signable state");
    }

    const { token, hash } = (() => {
      const t = generateToken(32);
      const h = hashToken(t);
      return { token: t, hash: h };
    })();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    await prisma.signingSession.create({
      data: {
        participantId: participant.id,
        tokenHash: hash,
        expiresAt,
      },
    });

    return {
      token,
      signingUrl: `${process.env.SIGNING_URL || "http://localhost:5174"}/session/${token}`,
      expiresAt,
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
          include: { contract: true },
        },
      },
    });

    if (!session) throw new NotFoundError("Signing session");
    if (!session.authenticatedAt) {
      throw new UnauthorizedError("Session not authenticated");
    }

    const { contract, id: participantId, name: signerName } = session.participant;

    // Load current document for hashing + signature application
    const currentVersion = await prisma.contractVersion.findFirst({
      where: { contractId: contract.id, isCurrent: true },
      include: { document: true },
    });

    let documentHashBefore = "no-document";
    if (currentVersion?.document) {
      try {
        const original = await storage.download(currentVersion.document.storageKey);
        documentHashBefore = sha256(original);
      } catch {
        documentHashBefore = currentVersion.sha256 || "unknown";
      }
    }

    // Create signature
    const signature = await prisma.signature.create({
      data: {
        contractId: session.participant.contractId,
        participantId,
        type: signatureData.type as any,
        imageData: signatureData.imageData,
        fieldX: signatureData.fieldX,
        fieldY: signatureData.fieldY,
        page: signatureData.page,
      },
    });

    // Apply the signature to the PDF
    if (currentVersion?.document && signatureData.fieldX !== undefined) {
      try {
        const original = await storage.download(currentVersion.document.storageKey);
        const { buffer, sha256After } = await applySignatures(original, [
          {
            page: signatureData.page || 1,
            x: signatureData.fieldX,
            y: signatureData.fieldY ?? signatureData.fieldX,
            width: 160,
            height: 50,
            name: signerName,
            date: new Date(),
            imageData: signatureData.imageData,
          },
        ]);

        // Store the signed PDF in the signed/ folder
        const signedKey = `${STORAGE_FOLDERS.SIGNED}/${contract.organizationId}/${contract.id}/v${currentVersion.version}-signed-${generateId()}.pdf`;
        await storage.upload(signedKey, buffer, "application/pdf");

        // Persist signed document as a new Document record
        const signedDoc = await prisma.document.create({
          data: {
            name: `${contract.title} - signed.pdf`,
            mimeType: "application/pdf",
            size: buffer.length,
            sha256: sha256After,
            storageKey: signedKey,
          },
        });

        // Update participant evidence with real hashes
        await prisma.signatureEvidence.create({
          data: {
            signatureId: signature.id,
            documentHashBefore,
            documentHashAfter: sha256After,
            authenticationMethod: "session-token",
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
        });
      } catch (error) {
        // Record evidence without PDF modification if rendering fails
        await prisma.signatureEvidence.create({
          data: {
            signatureId: signature.id,
            documentHashBefore,
            documentHashAfter: documentHashBefore,
            authenticationMethod: "session-token",
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
        });
      }
    } else {
      // No PDF to modify — record evidence only
      await prisma.signatureEvidence.create({
        data: {
          signatureId: signature.id,
          documentHashBefore,
          documentHashAfter: documentHashBefore,
          authenticationMethod: "session-token",
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
        },
      });
    }

    // Update participant status
    await prisma.participant.update({
      where: { id: participantId },
      data: { status: "SIGNED", signedAt: new Date() },
    });

    // Mark session complete
    await prisma.signingSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });

    await eventBus.emit({
      type: "participant.signed",
      organizationId: contract.organizationId,
      contractId: session.participant.contractId,
      participantId,
      occurredAt: new Date(),
    });

    // Check if all signers have signed → complete the contract
    await this.maybeCompleteContract(contract.id, contract.organizationId);

    return signature;
  }

  private async maybeCompleteContract(contractId: string, organizationId: string) {
    const [pending, total] = await Promise.all([
      prisma.participant.count({
        where: {
          contractId,
          type: { in: ["SIGNER", "APPROVER"] },
          status: { not: "SIGNED" },
        },
      }),
      prisma.participant.count({
        where: {
          contractId,
          type: { in: ["SIGNER", "APPROVER"] },
        },
      }),
    ]);

    const hasSignable = total > 0;

    if (hasSignable && pending === 0) {
      await prisma.$transaction([
        prisma.contract.update({
          where: { id: contractId },
          data: { status: "COMPLETED", completedAt: new Date() },
        }),
        prisma.signingStep.updateMany({
          where: { contractId, status: "WAITING" },
          data: { status: "COMPLETED", completedAt: new Date() },
        }),
      ]);

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
}
