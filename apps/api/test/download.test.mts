/**
 * AXS-013 — Download endpoints tests
 *
 * Tests:
 *  - sanitizeFilename unit tests
 *  - GET /contracts/:id/download (authenticated, org-scoped)
 *  - GET /certificates/contracts/:contractId/download (authenticated, org-scoped)
 *  - GET /signing/session/:token/download (public, token-gated, requires SIGNED status)
 *  - Previously unsanitized route: GET /documents/:id/download now returns safe header
 */

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
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
const { createStorageClient, STORAGE_FOLDERS } = await import("@axa-sign/storage");
const { generateCertificate } = await import("@axa-sign/pdf");
const { generateToken, hashToken } = await import("@axa-sign/shared");
const { signAccessToken } = await import("@axa-sign/auth");
const { emailQueue, getRedisConnection } = await import("@axa-sign/queue");
const { app } = await import("../src/app.js");
const { sanitizeFilename } = await import("../src/middleware/pdf-response.js");

const { SigningService } = await import("../src/modules/signing/signing.service.js");
const { DocumentService } = await import("../src/modules/documents/document.service.js");
const { ContractService } = await import("../src/modules/contracts/contract.service.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const storage = createStorageClient();
const createdOrgIds: string[] = [];
const createdStorageKeys: string[] = [];

function minimalPdfBuffer(label: string): Buffer {
  return Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`);
}

async function validPdfBuffer(label: string): Promise<Buffer> {
  return generateCertificate({
    contractTitle: label,
    contractId: label,
    documentHash: "0".repeat(64),
    completedAt: new Date(),
    participants: [],
    serialNumber: label,
    issuer: "AXS-013-test",
  });
}

function makeMulterFile(name: string, buffer: Buffer): Express.Multer.File {
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

async function seedOrg(label: string) {
  const org = await prisma.organization.create({
    data: { name: label, slug: `axs013-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
  });
  createdOrgIds.push(org.id);
  return org;
}

async function seedUser(organizationId: string, label: string) {
  return prisma.user.create({
    data: {
      email: `axs013-${label}-${Date.now()}@test.invalid`,
      firstName: "Test",
      lastName: label,
      passwordHash: "x",
      organizationId,
      role: "ADMIN",
    },
  });
}

async function seedContractWithDocument(
  organizationId: string,
  userId: string,
  pdfBuf: Buffer,
  docName: string
) {
  const docService = new DocumentService();
  const contractService = new ContractService();

  const contract = await contractService.create(organizationId, userId, {
    title: `Test Contract ${Date.now()}`,
    source: "MANUAL",
  });

  const doc = await docService.upload(
    organizationId,
    userId,
    makeMulterFile(docName, pdfBuf),
    contract.id
  );
  createdStorageKeys.push(doc.storageKey);

  return { contract, doc };
}

async function seedSignedSession(
  organizationId: string,
  contractId: string,
  participantStatus: "PENDING" | "SIGNED"
) {
  const participant = await prisma.participant.create({
    data: {
      contractId,
      name: "Signer One",
      email: `signer-${Date.now()}@test.invalid`,
      type: "SIGNER",
      signingOrder: 1,
      status: participantStatus,
    },
  });

  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  await prisma.signingSession.create({
    data: {
      participantId: participant.id,
      tokenHash: hashToken(token),
      expiresAt,
      ...(participantStatus === "SIGNED" ? { completedAt: new Date() } : {}),
    },
  });

  if (participantStatus === "SIGNED") {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { signedAt: new Date() },
    });
  }

  return { participant, token };
}

// ---------------------------------------------------------------------------
// 1. sanitizeFilename unit tests
// ---------------------------------------------------------------------------

await test("sanitizeFilename — strips double-quote", () => {
  assert.equal(sanitizeFilename(`My "Contract".pdf`), "My Contract.pdf");
});

await test("sanitizeFilename — strips CR and LF", () => {
  assert.equal(sanitizeFilename("evil\r\nheader\ninjection"), "evilheaderinjection");
});

await test("sanitizeFilename — strips backslash and path separators", () => {
  assert.equal(sanitizeFilename("path\\to/file"), "pathtofile");
});

await test("sanitizeFilename — normalizes accented characters", () => {
  const result = sanitizeFilename("Contrat André & Société");
  // After NFD + strip combining diacritics: accented chars become base ASCII
  assert.match(result, /^[^\u0080-\uFFFF]+$/);
});

await test("sanitizeFilename — truncates to 200 chars", () => {
  const long = "a".repeat(300);
  assert.equal(sanitizeFilename(long).length, 200);
});

await test("sanitizeFilename — falls back to 'document' on empty result", () => {
  assert.equal(sanitizeFilename(`"\r\n\\/`), "document");
});

await test("sanitizeFilename — passes through safe ASCII filename", () => {
  assert.equal(sanitizeFilename("invoice-2026-01.pdf"), "invoice-2026-01.pdf");
});

// ---------------------------------------------------------------------------
// 2. ContractService.download — integration tests
// ---------------------------------------------------------------------------

await test("contract download — owner gets 200 with correct bytes (DRAFT with document)", async () => {
  const org = await seedOrg("dl-owner");
  const user = await seedUser(org.id, "owner");
  const pdfBuf = await validPdfBuffer("AXS013-owner");

  const { contract } = await seedContractWithDocument(org.id, user.id, pdfBuf, "owner.pdf");

  const contractService = new ContractService();
  const { buffer, title } = await contractService.download(org.id, contract.id);

  assert.ok(buffer.length > 0, "buffer should not be empty");
  assert.equal(title, contract.title);
  assert.ok(buffer.toString("utf8", 0, 4) === "%PDF", "buffer should start with %PDF");
});

await test("contract download — cross-org request throws NotFoundError (404 convention)", async () => {
  const orgA = await seedOrg("dl-orgA");
  const orgB = await seedOrg("dl-orgB");
  const userA = await seedUser(orgA.id, "userA");
  const pdfBuf = await validPdfBuffer("AXS013-crossorg");

  const { contract } = await seedContractWithDocument(orgA.id, userA.id, pdfBuf, "contract.pdf");

  const contractService = new ContractService();
  await assert.rejects(
    () => contractService.download(orgB.id, contract.id),
    (err: any) => err.code === "NOT_FOUND"
  );
});

await test("contract download — DRAFT with no currentVersionId returns NotFoundError", async () => {
  const org = await seedOrg("dl-nodoc");
  const user = await seedUser(org.id, "nodocuser");

  const contractService = new ContractService();
  const contract = await contractService.create(org.id, user.id, {
    title: "No Document Contract",
    source: "MANUAL",
  });

  // No document attached, currentVersionId is null
  await assert.rejects(
    () => contractService.download(org.id, contract.id),
    (err: any) => err.code === "NOT_FOUND"
  );
});

// ---------------------------------------------------------------------------
// 3. SigningService.downloadSigned — integration tests
// ---------------------------------------------------------------------------

await test("signer download — 403 ForbiddenError before signing (status PENDING)", async () => {
  const org = await seedOrg("dl-signer-pending");
  const user = await seedUser(org.id, "sp-user");
  const pdfBuf = await validPdfBuffer("AXS013-pending");

  const { contract } = await seedContractWithDocument(org.id, user.id, pdfBuf, "pending.pdf");
  const { token } = await seedSignedSession(org.id, contract.id, "PENDING");

  const signingService = new SigningService();
  await assert.rejects(
    () => signingService.downloadSigned(token),
    (err: any) => err.code === "FORBIDDEN"
  );
});

await test("signer download — 200 with correct bytes after signing (status SIGNED)", async () => {
  const org = await seedOrg("dl-signer-signed");
  const user = await seedUser(org.id, "ss-user");
  const pdfBuf = await validPdfBuffer("AXS013-signed");

  const { contract } = await seedContractWithDocument(org.id, user.id, pdfBuf, "signed.pdf");
  const { token } = await seedSignedSession(org.id, contract.id, "SIGNED");

  const signingService = new SigningService();
  const { buffer, title } = await signingService.downloadSigned(token);

  assert.ok(buffer.length > 0, "buffer should not be empty");
  assert.equal(title, contract.title);
  assert.ok(buffer.toString("utf8", 0, 4) === "%PDF", "buffer should start with %PDF");
});

await test("signer download — expired token throws UnauthorizedError", async () => {
  const org = await seedOrg("dl-signer-expired");
  const user = await seedUser(org.id, "se-user");
  const pdfBuf = await validPdfBuffer("AXS013-expired");

  const { contract } = await seedContractWithDocument(org.id, user.id, pdfBuf, "expired.pdf");

  // Create session with already-expired expiresAt
  const participant = await prisma.participant.create({
    data: {
      contractId: contract.id,
      name: "Expired Signer",
      email: `expired-${Date.now()}@test.invalid`,
      type: "SIGNER",
      signingOrder: 1,
      status: "SIGNED",
      signedAt: new Date(),
    },
  });

  const token = generateToken(32);
  await prisma.signingSession.create({
    data: {
      participantId: participant.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() - 1000), // already expired
      completedAt: new Date(),
    },
  });

  const signingService = new SigningService();
  await assert.rejects(
    () => signingService.downloadSigned(token),
    (err: any) => err.code === "UNAUTHORIZED"
  );
});

await test("signer download — invalid token throws NotFoundError", async () => {
  const signingService = new SigningService();
  await assert.rejects(
    () => signingService.downloadSigned(generateToken(32)),
    (err: any) => err.code === "NOT_FOUND"
  );
});

// ---------------------------------------------------------------------------
// 4. Document download (previously unsanitized route) — safe Content-Disposition
// ---------------------------------------------------------------------------

await test("document download route — Content-Disposition is sanitized for unsafe filename", async () => {
  const org = await seedOrg("dl-doc-safe");
  const user = await seedUser(org.id, "ds-user");

  // Document name with characters that would break a raw Content-Disposition header
  const evilName = `"evil\r\nname".pdf`;
  const pdfBuf = await validPdfBuffer("AXS013-docheader");

  const docService = new DocumentService();
  const contract = await prisma.contract.create({
    data: {
      title: "DocHeader Test",
      organizationId: org.id,
      createdBy: user.id,
      source: "MANUAL",
    },
  });

  const doc = await docService.upload(
    org.id,
    user.id,
    makeMulterFile(evilName, pdfBuf),
    contract.id
  );

  // Confirm name was stored (storage key / mimeType exist)
  const stored = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
  // The route uses sendPdfAttachment(res, buffer, document.name) which calls sanitizeFilename.
  // Unit-test the sanitization directly since we can't send HTTP without a running server.
  const safe = sanitizeFilename(stored.name);
  assert.ok(!safe.includes('"'), `sanitized name should not contain quote: ${safe}`);
  assert.ok(!safe.includes("\r"), `sanitized name should not contain CR: ${JSON.stringify(safe)}`);
  assert.ok(!safe.includes("\n"), `sanitized name should not contain LF: ${JSON.stringify(safe)}`);
});

// ---------------------------------------------------------------------------
// 5. Certificate download — cross-org blocked
// ---------------------------------------------------------------------------

await test("certificate download — cross-org request throws NotFoundError", async () => {
  const orgA = await seedOrg("dl-cert-orgA");
  const orgB = await seedOrg("dl-cert-orgB");

  // Create a contract in orgA with a certificate
  const userA = await seedUser(orgA.id, "cert-userA");
  const contract = await prisma.contract.create({
    data: {
      title: "Cert Test Contract",
      organizationId: orgA.id,
      createdBy: userA.id,
      source: "MANUAL",
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  // Upload a minimal cert PDF to storage and create certificate record
  const certBuf = await validPdfBuffer("AXS013-cert");
  const certKey = `${STORAGE_FOLDERS.CERTIFICATES}/${orgA.id}/${contract.id}/certificate.pdf`;
  await storage.upload(certKey, certBuf, "application/pdf");
  createdStorageKeys.push(certKey);

  await prisma.certificate.create({
    data: {
      contractId: contract.id,
      serialNumber: `TEST-${Date.now()}`,
      subject: contract.title,
      issuer: "AXS-013-test",
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      pdfKey: certKey,
    },
  });

  const { CertificateService } = await import("../src/modules/certificates/certificate.service.js");
  const certService = new CertificateService();

  // orgB tries to download orgA's certificate
  await assert.rejects(
    () => certService.download(contract.id, orgB.id),
    (err: any) => err.code === "NOT_FOUND"
  );
});

// ---------------------------------------------------------------------------
// 6. HTTP route tests — headers, status codes, org-scoping, sanitization
// ---------------------------------------------------------------------------

await test("HTTP download routes — headers, status codes, and sanitization", async (t) => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  const orgA = await seedOrg("http-orgA");
  const orgB = await seedOrg("http-orgB");
  const userA = await seedUser(orgA.id, "http-userA");
  const userB = await seedUser(orgB.id, "http-userB");

  const tokenA = signAccessToken({
    sub: userA.id,
    email: userA.email,
    organizationId: orgA.id,
    role: userA.role,
  });
  const tokenB = signAccessToken({
    sub: userB.id,
    email: userB.email,
    organizationId: orgB.id,
    role: userB.role,
  });

  const pdfBuf = await validPdfBuffer("AXS013-http");
  const docService = new DocumentService();
  const contract = await prisma.contract.create({
    data: {
      title: `Contract "HTTP"\r\nTest`,
      organizationId: orgA.id,
      createdBy: userA.id,
      source: "MANUAL",
    },
  });

  const doc = await docService.upload(
    orgA.id,
    userA.id,
    makeMulterFile(`"unsafe\r\nname".pdf`, pdfBuf),
    contract.id
  );
  createdStorageKeys.push(doc.storageKey);

  await prisma.contract.update({
    where: { id: contract.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  // Seed certificate
  const certBuf = await validPdfBuffer("AXS013-http-cert");
  const certKey = `${STORAGE_FOLDERS.CERTIFICATES}/${orgA.id}/${contract.id}/certificate.pdf`;
  await storage.upload(certKey, certBuf, "application/pdf");
  createdStorageKeys.push(certKey);
  await prisma.certificate.create({
    data: {
      contractId: contract.id,
      serialNumber: `HTTP-${Date.now()}`,
      subject: contract.title,
      issuer: "AXS-013-test",
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      pdfKey: certKey,
    },
  });

  // Seed PENDING and SIGNED sessions
  const { token: pendingToken } = await seedSignedSession(orgA.id, contract.id, "PENDING");
  const { token: signedToken } = await seedSignedSession(orgA.id, contract.id, "SIGNED");

  // 1. Contract download (owner = 200, cross-org = 404)
  const contractRes = await fetch(`${baseUrl}/api/v1/contracts/${contract.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(contractRes.status, 200);
  assert.equal(contractRes.headers.get("content-type"), "application/pdf");
  assert.equal(contractRes.headers.get("cache-control"), "private, no-store");
  assert.equal(
    contractRes.headers.get("content-disposition"),
    `attachment; filename="Contract HTTPTest.pdf"`
  );
  const contractBytes = Buffer.from(await contractRes.arrayBuffer());
  assert.equal(contractBytes.toString("utf8", 0, 4), "%PDF");

  const contractCrossOrg = await fetch(`${baseUrl}/api/v1/contracts/${contract.id}/download`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.equal(contractCrossOrg.status, 404);

  // 2. Certificate download (owner = 200, cross-org = 404)
  const certRes = await fetch(
    `${baseUrl}/api/v1/certificates/contracts/${contract.id}/download`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert.equal(certRes.status, 200);
  assert.equal(certRes.headers.get("content-type"), "application/pdf");
  assert.equal(certRes.headers.get("cache-control"), "private, no-store");
  assert.equal(
    certRes.headers.get("content-disposition"),
    `attachment; filename="certificate-Contract HTTPTest.pdf"`
  );

  const certCrossOrg = await fetch(
    `${baseUrl}/api/v1/certificates/contracts/${contract.id}/download`,
    { headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert.equal(certCrossOrg.status, 404);

  // 3. Signer download (PENDING = 403, SIGNED = 200)
  const pendingRes = await fetch(`${baseUrl}/api/v1/signing/session/${pendingToken}/download`);
  assert.equal(pendingRes.status, 403);

  const signedRes = await fetch(`${baseUrl}/api/v1/signing/session/${signedToken}/download`);
  assert.equal(signedRes.status, 200);
  assert.equal(signedRes.headers.get("content-type"), "application/pdf");
  assert.equal(signedRes.headers.get("cache-control"), "private, no-store");
  assert.equal(
    signedRes.headers.get("content-disposition"),
    `attachment; filename="Contract HTTPTest.pdf"`
  );

  // 4. Previously unsanitized document download route
  const docRes = await fetch(`${baseUrl}/api/v1/documents/${doc.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(docRes.status, 200);
  assert.equal(docRes.headers.get("content-type"), "application/pdf");
  assert.equal(docRes.headers.get("cache-control"), "private, no-store");
  assert.equal(
    docRes.headers.get("content-disposition"),
    `attachment; filename="unsafename.pdf"`
  );
});

test.after(async () => {
  try {
    if (createdOrgIds.length > 0) {
      await prisma.contract.updateMany({
        where: { organizationId: { in: createdOrgIds } },
        data: { currentVersionId: null },
      });
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    for (const key of createdStorageKeys) {
      await storage.delete(key).catch(() => undefined);
    }
  } catch {}
  await emailQueue.close().catch(() => undefined);
  const redis = getRedisConnection();
  await redis.quit().catch(() => redis.disconnect());
  await prisma.$disconnect();
});
