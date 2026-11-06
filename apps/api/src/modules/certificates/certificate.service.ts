import prisma from "@axa-sign/database";
import { NotFoundError, ConflictError, generateId } from "@axa-sign/shared";
import { applySignatures, generateCertificate } from "@axa-sign/pdf";
import { StorageClient, STORAGE_FOLDERS } from "@axa-sign/storage";
import { eventBus } from "@axa-sign/events";

const storage = new StorageClient({
  endpoint: process.env.STORAGE_ENDPOINT || "localhost",
  port: Number(process.env.STORAGE_PORT) || 9000,
  bucket: process.env.STORAGE_BUCKET || "axa-sign",
  accessKey: process.env.STORAGE_ACCESS_KEY || "minioadmin",
  secretKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  useSSL: process.env.STORAGE_USE_SSL === "true",
});

const CERT_ISSUER = "AXA Sign (Tunaxa)";

export class CertificateService {
  /**
   * Generates the completion certificate + evidence package for a completed contract.
   */
  async generateForContract(contractId: string, organizationId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
      include: {
        participants: { orderBy: { signingOrder: "asc" }, where: { status: "SIGNED" } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { document: true },
        },
        signatures: true,
      },
    });

    if (!contract) throw new NotFoundError("Contract", contractId);
    if (contract.status !== "COMPLETED") {
      throw new ConflictError("Certificate can only be generated for completed contracts");
    }

    const document = contract.versions[0]?.document;
    const documentHash = contract.versions[0]?.sha256 || "unknown";

    const serialNumber = `AXA-${generateId("cert").slice(0, 20)}`;

    const certPdf = await generateCertificate({
      contractTitle: contract.title,
      contractId: contract.id,
      documentHash,
      completedAt: contract.completedAt || new Date(),
      participants: contract.participants.map((p) => ({
        name: p.name,
        email: p.email,
        role: p.role || p.type,
        signedAt: p.signedAt || new Date(),
      })),
      serialNumber,
      issuer: CERT_ISSUER,
    });

    // Store certificate PDF
    const certKey = `${STORAGE_FOLDERS.CERTIFICATES}/${organizationId}/${contractId}/certificate.pdf`;
    await storage.upload(certKey, certPdf, "application/pdf");

    // Persist certificate record
    const certificate = await prisma.certificate.create({
      data: {
        contractId,
        serialNumber,
        subject: contract.title,
        issuer: CERT_ISSUER,
        validFrom: contract.completedAt || new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        pdfKey: certKey,
      },
    });

    await eventBus.emit({
      type: "certificate.generated",
      organizationId,
      contractId,
      certificateId: certificate.id,
      occurredAt: new Date(),
    });

    return certificate;
  }

  async download(contractId: string, organizationId: string) {
    const certificate = await prisma.certificate.findFirst({
      where: { contractId, contract: { organizationId } },
    });
    if (!certificate) throw new NotFoundError("Certificate", contractId);

    const buffer = await storage.download(certificate.pdfKey);
    return { buffer, certificate };
  }
}