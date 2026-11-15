import prisma from "@axa-sign/database";
import { StorageClient, STORAGE_FOLDERS } from "@axa-sign/storage";
import { sha256 } from "@axa-sign/crypto";
import { NotFoundError, ConflictError, generateId } from "@axa-sign/shared";
import { eventBus } from "@axa-sign/events";

const storage = new StorageClient({
  endpoint: process.env.STORAGE_ENDPOINT || "localhost",
  port: Number(process.env.STORAGE_PORT) || 9000,
  bucket: process.env.STORAGE_BUCKET || "axa-sign",
  accessKey: process.env.STORAGE_ACCESS_KEY || "minioadmin",
  secretKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  useSSL: process.env.STORAGE_USE_SSL === "true",
});

export class DocumentService {
  async upload(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
    contractId?: string
  ) {
    const hash = sha256(file.buffer);
    const key = `${STORAGE_FOLDERS.ORIGINAL}/${organizationId}/${generateId()}-${file.originalname}`;

    if (contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, organizationId },
        select: { status: true },
      });
      if (!contract) throw new NotFoundError("Contract", contractId);
      if (contract.status !== "DRAFT") {
        throw new ConflictError("Can only add documents to contracts in DRAFT status");
      }
    }

    await storage.upload(key, file.buffer, file.mimetype);

    const { document, version } = await this.persistUpload(
      organizationId,
      contractId,
      userId,
      file,
      hash,
      key
    );

    await eventBus.emit({
      type: "document.uploaded",
      organizationId,
      documentId: document.id,
      contractId,
      occurredAt: new Date(),
    });

    return {
      ...document,
      contractVersion: version,
      currentVersionId: version?.id ?? null,
    };
  }

  private async persistUpload(
    organizationId: string,
    contractId: string | undefined,
    userId: string,
    file: Express.Multer.File,
    hash: string,
    key: string
  ) {
    try {
      if (contractId) {
        return await this.createContractVersion(
          organizationId,
          contractId,
          userId,
          file,
          hash,
          key
        );
      }

      return {
        document: await this.createDocument(file, hash, key),
        version: null,
      };
    } catch (error) {
      await storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  private documentData(
    file: Express.Multer.File,
    hash: string,
    key: string
  ) {
    return {
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      sha256: hash,
      storageKey: key,
    };
  }

  private async createDocument(
    file: Express.Multer.File,
    hash: string,
    key: string
  ) {
    return prisma.document.create({
      data: this.documentData(file, hash, key),
    });
  }

  private async createContractVersion(
    organizationId: string,
    contractId: string,
    userId: string,
    file: Express.Multer.File,
    hash: string,
    key: string
  ) {
    return prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findFirst({
        where: { id: contractId, organizationId },
        select: { status: true },
      });
      if (!contract) throw new NotFoundError("Contract", contractId);
      if (contract.status !== "DRAFT") {
        throw new ConflictError("Can only add documents to contracts in DRAFT status");
      }

      const document = await tx.document.create({
        data: this.documentData(file, hash, key),
      });

      const latest = await tx.contractVersion.findFirst({
        where: { contractId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      await tx.contractVersion.updateMany({
        where: { contractId, isCurrent: true },
        data: { isCurrent: false },
      });

      const version = await tx.contractVersion.create({
        data: {
          contractId,
          version: (latest?.version ?? 0) + 1,
          documentId: document.id,
          sha256: hash,
          isCurrent: true,
          createdBy: userId,
        },
      });

      await tx.contract.update({
        where: { id: contractId },
        data: { currentVersionId: version.id },
      });

      return { document, version };
    });
  }

  async getById(documentId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document) throw new NotFoundError("Document", documentId);
    return document;
  }

  async download(documentId: string) {
    const document = await this.getById(documentId);
    const buffer = await storage.download(document.storageKey);
    return { buffer, document };
  }

  async delete(documentId: string) {
    const document = await this.getById(documentId);
    await storage.delete(document.storageKey);
    await prisma.document.delete({ where: { id: documentId } });
  }
}
