import prisma from "@axa-sign/database";
import { StorageClient } from "@axa-sign/storage";
import { sha256, NotFoundError, generateId } from "@axa-sign/shared";
import { STORAGE_FOLDERS } from "@axa-sign/storage";
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
    file: Express.Multer.File,
    contractId?: string
  ) {
    const hash = sha256(file.buffer);
    const key = `${STORAGE_FOLDERS.ORIGINAL}/${organizationId}/${generateId()}-${file.originalname}`;

    await storage.upload(key, file.buffer, file.mimetype);

    const document = await prisma.document.create({
      data: {
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        sha256: hash,
        storageKey: key,
      },
    });

    if (contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, organizationId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });

      if (contract) {
        const nextVersion = (contract.versions[0]?.version ?? 0) + 1;

        await prisma.contractVersion.updateMany({
          where: { contractId },
          data: { isCurrent: false },
        });

        const version = await prisma.contractVersion.create({
          data: {
            contractId,
            version: nextVersion,
            documentId: document.id,
            sha256: hash,
            isCurrent: true,
            createdBy: contract.createdBy,
          },
        });

        await prisma.contract.update({
          where: { id: contractId },
          data: { currentVersionId: version.id },
        });
      }
    }

    await eventBus.emit({
      type: "document.uploaded",
      organizationId,
      documentId: document.id,
      contractId,
      occurredAt: new Date(),
    });

    return document;
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
