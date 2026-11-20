import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const { default: prisma } = await import("@axa-sign/database");
const { sha256 } = await import("@axa-sign/crypto");
const { createStorageClient, STORAGE_FOLDERS } = await import("@axa-sign/storage");
const { generateCertificate } = await import("@axa-sign/pdf");
const { DocumentService } = await import(
  "../src/modules/documents/document.service.js"
);
const { TemplateEngine } = await import(
  "../src/modules/templates/template-engine.service.js"
);
const { SigningService } = await import(
  "../src/modules/signing/signing.service.js"
);

const SIGNATURE_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X1uAAAAABJRU5ErkJggg==";

function pdfBytes(label: string) {
  return Buffer.from(`%PDF-1.4\n% TUN2-81 ${label}\n%%EOF\n`);
}

async function validPdfBytes(label: string) {
  return generateCertificate({
    contractTitle: label,
    contractId: label,
    documentHash: "0".repeat(64),
    completedAt: new Date(),
    participants: [],
    serialNumber: label,
    issuer: "TUN2-81",
  });
}

function makeFile(name: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype: "application/pdf",
    size: buffer.length,
    buffer,
    destination: "",
    filename: name,
    path: "",
  } as unknown as Express.Multer.File;
}

async function expectNotFound(action: () => Promise<unknown>) {
  await assert.rejects(action, (error: any) => error.statusCode === 404);
}

test("TUN2-81: documents are scoped to their organization", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const storage = createStorageClient();
  const documents = new DocumentService();
  const engine = new TemplateEngine();
  const signing = new SigningService();
  const organizationIds: string[] = [];
  const storageKeys: string[] = [];

  try {
    await storage.ensureBucket();

    const organizationA = await prisma.organization.create({
      data: { name: `TUN2-81 A ${suffix}`, slug: `tun2-81-a-${suffix}` },
    });
    const organizationB = await prisma.organization.create({
      data: { name: `TUN2-81 B ${suffix}`, slug: `tun2-81-b-${suffix}` },
    });
    organizationIds.push(organizationA.id, organizationB.id);

    const userA = await prisma.user.create({
      data: {
        email: `tun2-81-a-${suffix}@example.test`,
        passwordHash: "not-used",
        firstName: "TUN2",
        lastName: "EightyOneA",
        organizationId: organizationA.id,
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `tun2-81-b-${suffix}@example.test`,
        passwordHash: "not-used",
        firstName: "TUN2",
        lastName: "EightyOneB",
        organizationId: organizationB.id,
      },
    });

    await t.test("upload sets organizationId and same-organization access works", async () => {
      const uploaded: any = await documents.upload(
        organizationA.id,
        userA.id,
        makeFile(`standalone-${suffix}.pdf`, pdfBytes("standalone"))
      );
      storageKeys.push(uploaded.storageKey);

      assert.equal(uploaded.organizationId, organizationA.id);
      const fetched = await documents.getById(organizationA.id, uploaded.id);
      assert.equal(fetched.organizationId, organizationA.id);
      const downloaded = await documents.download(organizationA.id, uploaded.id);
      assert.equal(downloaded.buffer.length, uploaded.size);

      await documents.delete(organizationA.id, uploaded.id);
      assert.equal(
        await prisma.document.count({ where: { id: uploaded.id } }),
        0
      );
    });

    await t.test("another organization gets 404 and preserves the row and object", async () => {
      const uploaded: any = await documents.upload(
        organizationA.id,
        userA.id,
        makeFile(`cross-org-${suffix}.pdf`, pdfBytes("cross-org"))
      );
      storageKeys.push(uploaded.storageKey);

      await expectNotFound(() => documents.getById(organizationB.id, uploaded.id));
      await expectNotFound(() => documents.download(organizationB.id, uploaded.id));
      await expectNotFound(() => documents.delete(organizationB.id, uploaded.id));

      const row = await prisma.document.findUnique({ where: { id: uploaded.id } });
      assert.ok(row);
      assert.equal(row.organizationId, organizationA.id);
      const object = await storage.download(uploaded.storageKey);
      assert.equal(object.length, uploaded.size);
    });

    await t.test("contract documents are not reachable by another organization", async () => {
      const contract = await prisma.contract.create({
        data: {
          title: `TUN2-81 contract ${suffix}`,
          organizationId: organizationA.id,
          createdBy: userA.id,
        },
      });
      const uploaded: any = await documents.upload(
        organizationA.id,
        userA.id,
        makeFile(`contract-${suffix}.pdf`, pdfBytes("contract")),
        contract.id
      );
      storageKeys.push(uploaded.storageKey);

      assert.equal(uploaded.organizationId, organizationA.id);
      await expectNotFound(() => documents.getById(organizationB.id, uploaded.id));
      await expectNotFound(() => documents.download(organizationB.id, uploaded.id));
      await expectNotFound(() => documents.delete(organizationB.id, uploaded.id));

      const row = await prisma.document.findUnique({ where: { id: uploaded.id } });
      assert.ok(row);
      const object = await storage.download(uploaded.storageKey);
      assert.equal(object.length, uploaded.size);
    });

    await t.test("template-generated documents carry the organization", async () => {
      const bytes = pdfBytes("template");
      const storageKey = `${STORAGE_FOLDERS.TEMPLATES}/${organizationA.id}/${suffix}-source.pdf`;
      await storage.upload(storageKey, bytes, "application/pdf");
      storageKeys.push(storageKey);

      const sourceDocument = await prisma.document.create({
        data: {
          name: `source-${suffix}.pdf`,
          mimeType: "application/pdf",
          size: bytes.length,
          sha256: sha256(bytes),
          storageKey,
          organizationId: organizationA.id,
        },
      });
      const template = await prisma.template.create({
        data: {
          name: `TUN2-81 Template ${suffix}`,
          organizationId: organizationA.id,
        },
      });
      await prisma.templateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          documentId: sourceDocument.id,
          sha256: sha256(bytes),
        },
      });

      const result: any = await engine.generateContractFromTemplate(
        organizationA.id,
        userA.id,
        template.id,
        {},
        [{ email: `template-${suffix}@example.test`, name: "Template Signer" }]
      );
      const generated = await prisma.document.findUnique({
        where: { id: result.document.id },
      });
      assert.ok(generated);
      assert.equal(generated.organizationId, organizationA.id);
    });

    await t.test("signed documents carry the organization", async () => {
      const contract = await prisma.contract.create({
        data: {
          title: `TUN2-81 signed ${suffix}`,
          organizationId: organizationA.id,
          createdBy: userA.id,
        },
      });
      const uploaded: any = await documents.upload(
        organizationA.id,
        userA.id,
        makeFile(`signed-source-${suffix}.pdf`, await validPdfBytes(suffix)),
        contract.id
      );
      storageKeys.push(uploaded.storageKey);
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: "SENT" },
      });
      const participant = await prisma.participant.create({
        data: {
          contractId: contract.id,
          name: "Signer",
          email: `signed-${suffix}@example.test`,
          type: "SIGNER",
          signingOrder: 0,
        },
      });
      const session = await signing.createSession(contract.id, participant.id);
      await signing.authenticate(session.token);
      await signing.sign(session.token, {
        type: "DRAWN",
        imageData: SIGNATURE_DATA,
        fieldX: 100,
        fieldY: 100,
        page: 1,
      });

      const signedDocuments = await prisma.document.findMany({
        where: {
          organizationId: organizationA.id,
          name: `${contract.title} - signed.pdf`,
        },
      });
      assert.equal(signedDocuments.length, 1);
      assert.equal(signedDocuments[0].organizationId, organizationA.id);
      storageKeys.push(signedDocuments[0].storageKey);
    });
  } finally {
    try {
      await prisma.signingSession.deleteMany({
        where: { participant: { contract: { organizationId: { in: organizationIds } } } },
      });
      await prisma.signatureEvidence.deleteMany({
        where: { signature: { contract: { organizationId: { in: organizationIds } } } },
      });
      await prisma.signature.deleteMany({
        where: { contract: { organizationId: { in: organizationIds } } },
      });
      await prisma.signingStep.deleteMany({
        where: { contract: { organizationId: { in: organizationIds } } },
      });
      await prisma.participant.deleteMany({
        where: { contract: { organizationId: { in: organizationIds } } },
      });
      await prisma.contractVersion.deleteMany({
        where: { contract: { organizationId: { in: organizationIds } } },
      });
      await prisma.contract.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.templateVersion.deleteMany({
        where: { template: { organizationId: { in: organizationIds } } },
      });
      await prisma.document.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.template.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.user.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    } catch {}

    for (const key of storageKeys) {
      try {
        await storage.delete(key);
      } catch {}
    }

    await prisma.$disconnect();
  }
});
