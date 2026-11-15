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
const { createStorageClient } = await import("@axa-sign/storage");
const { DocumentService } = await import(
  "../src/modules/documents/document.service.js"
);

function pdfBytes(label: string) {
  return Buffer.from(`%PDF-1.4\n% TUN2-7 ${label}\n%%EOF\n`);
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

test("TUN2-7: document upload creates a ContractVersion", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const storage = createStorageClient();
  const service = new DocumentService();
  const documentIds: string[] = [];
  const storageKeys: string[] = [];
  const organizationIds: string[] = [];

  try {
    await storage.ensureBucket();

    const organization = await prisma.organization.create({
      data: { name: `TUN2-7 ${suffix}`, slug: `tun2-7-${suffix}` },
    });
    organizationIds.push(organization.id);

    const user = await prisma.user.create({
      data: {
        email: `tun2-7-${suffix}@example.test`,
        passwordHash: "not-used",
        firstName: "TUN2",
        lastName: "Seven",
        organizationId: organization.id,
      },
    });

    const contract = await prisma.contract.create({
      data: {
        title: `TUN2-7 Contract ${suffix}`,
        organizationId: organization.id,
        createdBy: user.id,
      },
    });

    await t.test("creates version 1 as current on first upload", async () => {
      const bytes = pdfBytes("first");
      const result: any = await service.upload(
        organization.id,
        user.id,
        makeFile(`first-${suffix}.pdf`, bytes),
        contract.id
      );
      documentIds.push(result.id);
      storageKeys.push(result.storageKey);

      const updated = await prisma.contract.findUnique({
        where: { id: contract.id },
        include: { versions: true },
      });

      assert.ok(updated);
      assert.equal(updated.currentVersionId, result.contractVersion.id);
      assert.notEqual(updated.currentVersionId, result.id);
      assert.equal(result.contractVersion.version, 1);
      assert.equal(result.contractVersion.isCurrent, true);
      assert.equal(result.contractVersion.documentId, result.id);
      assert.equal(result.contractVersion.sha256, sha256(bytes));
      assert.equal(result.sha256, sha256(bytes));
      assert.equal(updated.versions.length, 1);
    });

    await t.test("creates version 2 and supersedes version 1 on a DRAFT contract", async () => {
      const bytes = pdfBytes("second");
      const result: any = await service.upload(
        organization.id,
        user.id,
        makeFile(`second-${suffix}.pdf`, bytes),
        contract.id
      );
      documentIds.push(result.id);
      storageKeys.push(result.storageKey);

      const versions = await prisma.contractVersion.findMany({
        where: { contractId: contract.id },
        orderBy: { version: "asc" },
      });
      const updated = await prisma.contract.findUnique({
        where: { id: contract.id },
      });

      assert.ok(updated);
      assert.deepEqual(
        versions.map((version) => version.version),
        [1, 2]
      );
      assert.equal(versions[0].isCurrent, false);
      assert.equal(versions[1].isCurrent, true);
      assert.equal(updated.currentVersionId, versions[1].id);
      assert.equal(result.contractVersion.version, 2);
      assert.equal(result.contractVersion.sha256, sha256(bytes));
    });

    await t.test("rejects uploads to a non-DRAFT contract without changes", async () => {
      const frozen = await prisma.contract.create({
        data: {
          title: `TUN2-7 Frozen ${suffix}`,
          organizationId: organization.id,
          createdBy: user.id,
        },
      });
      const first: any = await service.upload(
        organization.id,
        user.id,
        makeFile(`frozen-${suffix}.pdf`, pdfBytes("frozen")),
        frozen.id
      );
      documentIds.push(first.id);
      storageKeys.push(first.storageKey);

      const before = await prisma.contract.findUnique({
        where: { id: frozen.id },
        include: { versions: true },
      });
      await prisma.contract.update({
        where: { id: frozen.id },
        data: { status: "SENT" },
      });

      await assert.rejects(
        () =>
          service.upload(
            organization.id,
            user.id,
            makeFile(`frozen-late-${suffix}.pdf`, pdfBytes("late")),
            frozen.id
          ),
        (error: any) => error.statusCode === 409 && /DRAFT/.test(error.message)
      );

      const after = await prisma.contract.findUnique({
        where: { id: frozen.id },
        include: { versions: true },
      });

      assert.ok(before && after);
      assert.equal(after.versions.length, before.versions.length);
      assert.equal(after.currentVersionId, before.currentVersionId);
      assert.equal(
        await prisma.document.count({
          where: { name: `frozen-late-${suffix}.pdf` },
        }),
        0
      );
    });

    await t.test("returns 404 for another organization's contract", async () => {
      const otherOrganization = await prisma.organization.create({
        data: {
          name: `TUN2-7 Other ${suffix}`,
          slug: `tun2-7-other-${suffix}`,
        },
      });
      organizationIds.push(otherOrganization.id);

      const otherUser = await prisma.user.create({
        data: {
          email: `tun2-7-other-${suffix}@example.test`,
          passwordHash: "not-used",
          firstName: "Other",
          lastName: "User",
          organizationId: otherOrganization.id,
        },
      });

      const otherContract = await prisma.contract.create({
        data: {
          title: `TUN2-7 Other ${suffix}`,
          organizationId: otherOrganization.id,
          createdBy: otherUser.id,
        },
      });

      await assert.rejects(
        () =>
          service.upload(
            organization.id,
            user.id,
            makeFile(`foreign-${suffix}.pdf`, pdfBytes("foreign")),
            otherContract.id
          ),
        (error: any) => error.statusCode === 404 && /not found/i.test(error.message)
      );

      assert.equal(
        await prisma.document.count({
          where: { name: `foreign-${suffix}.pdf` },
        }),
        0
      );
      assert.equal(
        await prisma.contractVersion.count({
          where: { contractId: otherContract.id },
        }),
        0
      );
    });

    await t.test("rolls back the document when the version step fails", async () => {
      const atomic = await prisma.contract.create({
        data: {
          title: `TUN2-7 Atomic ${suffix}`,
          organizationId: organization.id,
          createdBy: user.id,
        },
      });

      await assert.rejects(() =>
        service.upload(
          organization.id,
          undefined as unknown as string,
          makeFile(`atomic-${suffix}.pdf`, pdfBytes("atomic")),
          atomic.id
        )
      );

      const after = await prisma.contract.findUnique({
        where: { id: atomic.id },
        include: { versions: true },
      });

      assert.ok(after);
      assert.equal(after.versions.length, 0);
      assert.equal(after.currentVersionId, null);
      assert.equal(
        await prisma.document.count({
          where: { name: `atomic-${suffix}.pdf` },
        }),
        0
      );
    });
  } finally {
    for (const id of organizationIds) {
      try {
        await prisma.organization.delete({ where: { id } });
      } catch {
        // best-effort cleanup
      }
    }

    if (documentIds.length > 0) {
      try {
        await prisma.document.deleteMany({
          where: { id: { in: documentIds } },
        });
      } catch {
        // best-effort cleanup
      }
    }

    for (const key of storageKeys) {
      try {
        await storage.delete(key);
      } catch {
        // best-effort cleanup
      }
    }

    await prisma.$disconnect();
  }
});
