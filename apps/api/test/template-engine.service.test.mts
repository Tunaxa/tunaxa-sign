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
const { sha256 } = await import("@axa-sign/shared");
const { createStorageClient, STORAGE_FOLDERS } = await import("@axa-sign/storage");
const { TemplateEngine } = await import(
  "../src/modules/templates/template-engine.service.js"
);

test("TUN2-9: template generation links currentVersionId to an atomic ContractVersion", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const storage = createStorageClient();
  const engine = new TemplateEngine();
  const bytes = Buffer.from(`%PDF-1.4\n% TUN2-9 atomic test ${suffix}\n%%EOF\n`);
  const storageKey = `${STORAGE_FOLDERS.TEMPLATES}/${suffix}/source.pdf`;

  let organizationId = "";
  let sourceDocumentId = "";
  let generatedDocumentName = "";

  try {
    await storage.ensureBucket();
    await storage.upload(storageKey, bytes, "application/pdf");

    const organization = await prisma.organization.create({
      data: {
        name: `TUN2-9 Atomic ${suffix}`,
        slug: `tun2-9-atomic-${suffix}`,
      },
    });
    organizationId = organization.id;

    const user = await prisma.user.create({
      data: {
        email: `tun2-9-${suffix}@example.test`,
        passwordHash: "not-used",
        firstName: "TUN2",
        lastName: "Nine",
        organizationId: organization.id,
      },
    });

    const sourceDocument = await prisma.document.create({
      data: {
        name: "tun2-9-source.pdf",
        mimeType: "application/pdf",
        size: bytes.length,
        sha256: sha256(bytes),
        storageKey,
        organizationId: organization.id,
      },
    });
    sourceDocumentId = sourceDocument.id;

    const template = await prisma.template.create({
      data: {
        name: `TUN2-9 Test Template ${suffix}`,
        organizationId: organization.id,
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

    generatedDocumentName = `${template.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    const variables = {
      company_name: "Acme Corp",
      effective_date: "2026-11-15",
      payment_amount: "1000",
    };

    await t.test("rolls back contract, document and version when a later step fails", async () => {
      await assert.rejects(
        engine.generateContractFromTemplate(
          organization.id,
          user.id,
          template.id,
          variables,
          [
            {
              email: "bad@example.test",
              name: "Bad Signer",
              type: "NOT_A_TYPE" as any,
              role: "Signer",
            },
          ]
        )
      );

      assert.equal(
        await prisma.contract.count({ where: { organizationId: organization.id } }),
        0
      );
      assert.equal(
        await prisma.contractVersion.count({
          where: { contract: { organizationId: organization.id } },
        }),
        0
      );
      assert.equal(
        await prisma.document.count({ where: { name: generatedDocumentName } }),
        0
      );
    });

    await t.test("sets currentVersionId to the ContractVersion id and links the document", async () => {
      const generated = await engine.generateContractFromTemplate(
        organization.id,
        user.id,
        template.id,
        variables,
        [
          {
            email: "signer@example.test",
            name: "Signer One",
            type: "SIGNER",
            role: "Client Signer",
          },
        ]
      );

      const contract = await prisma.contract.findUnique({
        where: { id: generated.contract.id },
        include: {
          currentVersion: { include: { document: true } },
          versions: true,
          participants: true,
        },
      });

      assert.ok(contract);
      assert.ok(contract.currentVersion);
      assert.equal(contract.currentVersionId, contract.currentVersion.id);
      assert.notEqual(contract.currentVersionId, contract.currentVersion.documentId);
      assert.equal(
        contract.currentVersion.documentId,
        contract.currentVersion.document.id
      );
      assert.equal(contract.currentVersion.isCurrent, true);
      assert.equal(contract.currentVersion.sha256, sha256(bytes));
      assert.equal(contract.currentVersion.document.sha256, sha256(bytes));
      assert.equal(contract.versions.length, 1);
      assert.equal(contract.participants.length, 1);
      assert.equal(contract.organizationId, organization.id);
    });

    await t.test("does not generate from another organization's template", async () => {
      await assert.rejects(
        engine.generateContractFromTemplate(
          `other-org-${suffix}`,
          user.id,
          template.id,
          variables,
          [{ email: "signer@example.test", type: "SIGNER" }]
        ),
        /not found/i
      );

      assert.equal(
        await prisma.contract.count({ where: { organizationId: organization.id } }),
        1
      );
    });
  } finally {
    if (organizationId) {
      try {
        await prisma.organization.delete({ where: { id: organizationId } });
      } catch {
        // best-effort cleanup
      }
    }

    const documentIds = [sourceDocumentId];
    if (generatedDocumentName) {
      const generatedDocuments = await prisma.document.findMany({
        where: { name: generatedDocumentName },
        select: { id: true },
      });
      documentIds.push(...generatedDocuments.map((document) => document.id));
    }
    const idsToDelete = documentIds.filter((id) => id.length > 0);
    if (idsToDelete.length > 0) {
      try {
        await prisma.document.deleteMany({ where: { id: { in: idsToDelete } } });
      } catch {
        // best-effort cleanup
      }
    }

    try {
      await storage.delete(storageKey);
    } catch {
      // best-effort cleanup
    }

    await prisma.$disconnect();
  }
});
