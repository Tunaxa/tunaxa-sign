import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEvent } from "@axa-sign/domain";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
process.env.NODE_ENV = "test";

const require = createRequire(resolve(repoRoot, "package.json"));
const { PDFDocument, StandardFonts } = require("pdf-lib");
const { default: prisma } = await import("@axa-sign/database");
const { verifyAuditChain } = await import("@axa-sign/domain");
const { createStorageClient } = await import("@axa-sign/storage");
const { emailQueue, getRedisConnection } = await import("@axa-sign/queue");
const { AuditService } = await import("../src/modules/audit/audit.service.js");
const { DocumentService } = await import("../src/modules/documents/document.service.js");
const { ContractService } = await import("../src/modules/contracts/contract.service.js");

const audit = new AuditService();
const documents = new DocumentService();
const contracts = new ContractService();
const storage = createStorageClient();
const orgIds: string[] = [];
const storageKeys: string[] = [];

async function createOrg(label: string) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const org = await prisma.organization.create({
    data: { name: `${label} ${suffix}`, slug: `${label.toLowerCase()}-${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `${label.toLowerCase()}-${suffix}@example.test`,
      passwordHash: "not-used",
      firstName: "Audit",
      lastName: "Tester",
      organizationId: org.id,
    },
  });
  orgIds.push(org.id);
  return { org, user };
}

async function readChain(organizationId: string) {
  const events = await prisma.auditEvent.findMany({
    where: { organizationId },
    orderBy: { sequence: "asc" },
  });
  return { events, trail: verifyAuditChain(events as unknown as AuditEvent[]) };
}

function appendMany(organizationId: string, count: number, label: string) {
  return Array.from({ length: count }, (_, index) =>
    audit.recordEvent({
      type: "test.parallel.append",
      organizationId,
      data: { index, label },
    })
  );
}

function assertSequences(events: Array<{ sequence: number }>, expected: number) {
  assert.deepEqual(
    events.map((event) => event.sequence),
    Array.from({ length: expected }, (_, index) => index + 1)
  );
}

async function pdf(label: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(label, { x: 48, y: 740, size: 12, font });
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

function makeFile(bytes: Buffer, name: string): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype: "application/pdf",
    size: bytes.length,
    buffer: bytes,
    destination: "",
    filename: name,
    path: "",
  } as unknown as Express.Multer.File;
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|mts|tsx|js)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("TUN2-83: audit appends are serialized per organization", { timeout: 120000 }, async (t) => {
  await storage.ensureBucket();

  try {
    await t.test("20 parallel appends are valid and repeatable", async () => {
      for (let run = 0; run < 10; run++) {
        const { org } = await createOrg(`audit-chain-run-${run}`);
        const results = await Promise.allSettled(appendMany(org.id, 20, `run-${run}`));
        assert.equal(results.filter((result) => result.status === "rejected").length, 0);
        const { events, trail } = await readChain(org.id);
        assert.equal(events.length, 20);
        assertSequences(events, 20);
        assert.equal(trail.isValid, true, `run ${run}: invalid chain`);
      }
    });

    await t.test("interleaved appends keep two organization chains independent", async () => {
      const a = await createOrg("audit-chain-org-a");
      const b = await createOrg("audit-chain-org-b");
      const results = await Promise.allSettled([
        ...Array.from({ length: 20 }, (_, index) =>
          audit.recordEvent({
            type: "test.interleaved.append",
            organizationId: a.org.id,
            data: { index, organization: "a" },
          })
        ),
        ...Array.from({ length: 20 }, (_, index) =>
          audit.recordEvent({
            type: "test.interleaved.append",
            organizationId: b.org.id,
            data: { index, organization: "b" },
          })
        ),
      ]);
      assert.equal(results.filter((result) => result.status === "rejected").length, 0);
      const chainA = await readChain(a.org.id);
      const chainB = await readChain(b.org.id);
      assertSequences(chainA.events, 20);
      assertSequences(chainB.events, 20);
      assert.equal(chainA.trail.isValid, true);
      assert.equal(chainB.trail.isValid, true);

      const scopedA = await audit.getOrganizationAudit(a.org.id, { limit: 100 });
      const scopedB = await audit.getOrganizationAudit(b.org.id, { limit: 100 });
      assert.equal(scopedA.data.length, 20);
      assert.equal(scopedB.data.length, 20);
      assert.equal(scopedA.data.some((event: any) => event.organizationId === b.org.id), false);
      assert.equal(scopedB.data.some((event: any) => event.organizationId === a.org.id), false);
    });

    await t.test("a failed append leaves no event and does not block the next append", async () => {
      const { org } = await createOrg("audit-chain-failure");
      const before = await readChain(org.id);
      assert.equal(before.events.length, 0);

      await assert.rejects(
        audit.recordEvent({
          type: "test.failed.append",
          organizationId: org.id,
          data: { invalid: BigInt(1) },
        })
      );

      const afterFailure = await readChain(org.id);
      assert.equal(afterFailure.events.length, 0);
      assert.equal(afterFailure.trail.isValid, true);

      await Promise.all(appendMany(org.id, 2, "after-failure"));
      const afterSuccess = await readChain(org.id);
      assertSequences(afterSuccess.events, 2);
      assert.equal(afterSuccess.trail.isValid, true);
    });

    await t.test("lock timeout fails clearly and other organizations are not blocked", async () => {
      const a = await createOrg("audit-chain-lock-a");
      const b = await createOrg("audit-chain-lock-b");
      let release = () => undefined;
      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${a.org.id}::text))::text AS lock_result`;
        await new Promise<void>((resolveHold) => {
          release = resolveHold;
        });
      }, { timeout: 15000 });

      try {
        await new Promise((resolveWait) => setTimeout(resolveWait, 250));
        const otherStarted = Date.now();
        await Promise.all(appendMany(b.org.id, 1, "not-blocked"));
        const otherElapsed = Date.now() - otherStarted;
        assert.ok(otherElapsed < 2000, `other organization took ${otherElapsed}ms`);

        const started = Date.now();
        await assert.rejects(
          audit.recordEvent({
            type: "test.lock.timeout",
            organizationId: a.org.id,
            data: { index: 0 },
          }),
          /timed out after 5s/
        );
        const elapsed = Date.now() - started;
        assert.ok(elapsed >= 4500 && elapsed < 9000, `lock wait was ${elapsed}ms`);
      } finally {
        release();
        await holder;
      }

      const chainA = await readChain(a.org.id);
      const chainB = await readChain(b.org.id);
      assert.equal(chainA.events.length, 0);
      assertSequences(chainB.events, 1);
      assert.equal(chainB.trail.isValid, true);
    });

    await t.test("8 contracts sent in parallel keep one valid chain", async () => {
      const { org, user } = await createOrg("audit-chain-sends");
      const contractIds: string[] = [];
      for (let index = 0; index < 8; index++) {
        const contract = await prisma.contract.create({
          data: {
            title: `Parallel audit contract ${index}`,
            organizationId: org.id,
            createdBy: user.id,
          },
        });
        contractIds.push(contract.id);
        const upload = await documents.upload(
          org.id,
          user.id,
          makeFile(await pdf(`Parallel audit ${index}`), `parallel-audit-${index}.pdf`),
          contract.id
        );
        storageKeys.push(upload.storageKey);
        await prisma.participant.create({
          data: {
            contractId: contract.id,
            name: `Signer ${index}`,
            email: `audit-chain-signer-${index}-${org.id}@example.test`,
            type: "SIGNER",
            signingOrder: 0,
          },
        });
      }

      const sends = await Promise.all(
        contractIds.map((contractId) => contracts.send(org.id, contractId, user.id))
      );
      assert.equal(sends.length, 8);
      const { events, trail } = await readChain(org.id);
      assert.equal(events.length, 8);
      assertSequences(events, 8);
      assert.equal(trail.isValid, true);
    });

    await t.test("tampered previousHash is detected without modifying audit rows", async () => {
      const { org } = await createOrg("audit-chain-tamper");
      await Promise.all(appendMany(org.id, 3, "tamper"));
      const { events, trail } = await readChain(org.id);
      assert.equal(trail.isValid, true);
      const tampered = events.map((event) => ({ ...event })) as unknown as AuditEvent[];
      tampered[1].previousHash = "tampered-previous-hash";
      const invalid = verifyAuditChain(tampered);
      assert.equal(invalid.isValid, false);
      assert.equal(invalid.brokenAt, 1);
      assert.equal((await readChain(org.id)).trail.isValid, true);
    });

    await t.test("audit and admin reads reject unauthenticated and wrong-role callers", async () => {
      const { app } = await import("../src/app.js");
      const { generateTokenPair } = await import("@axa-sign/auth");
      const { org, user } = await createOrg("audit-chain-http");
      const server = app.listen(0);

      try {
        await new Promise((resolveListen) => server.once("listening", resolveListen));
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("No ephemeral HTTP port");
        const base = `http://127.0.0.1:${address.port}/api/v1`;
        const forwarded = `10.99.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

        const unauthenticated = await fetch(`${base}/audit`, {
          headers: { "x-forwarded-for": forwarded, connection: "close" },
        });
        assert.equal(unauthenticated.status, 401);
        await unauthenticated.text();

        const memberToken = generateTokenPair({
          sub: user.id,
          email: user.email,
          organizationId: org.id,
          role: "MEMBER",
        }).accessToken;
        const forbidden = await fetch(`${base}/admin/audit-events`, {
          headers: {
            authorization: `Bearer ${memberToken}`,
            "x-forwarded-for": forwarded,
            connection: "close",
          },
        });
        assert.equal(forbidden.status, 403);
        assert.equal((await forbidden.text()).includes("stack"), false);
      } finally {
        server.closeAllConnections?.();
        await new Promise((resolveClose) => server.close(resolveClose));
      }
    });

    await t.test("no code outside the audit service writes audit rows", () => {
      const writerPattern = new RegExp("auditEvent\\.(create|createMany|update|upsert|delete)");
      const insertPattern = new RegExp("INSERT\\s+INTO\\s+[\"']?audit_events", "i");
      const servicePath = resolve(here, "..", "src", "modules", "audit", "audit.service.ts");
      const offenders: string[] = [];

      for (const root of ["apps", "packages", "scripts"]) {
        for (const file of sourceFiles(resolve(repoRoot, root))) {
          if (file === servicePath) continue;
          const content = readFileSync(file, "utf8");
          if (writerPattern.test(content) || insertPattern.test(content)) {
            offenders.push(file.slice(repoRoot.length + 1).replace(/\\/g, "/"));
          }
        }
      }

      assert.deepEqual(offenders, []);
    });
  } finally {
    try {
      if (orgIds.length > 0) {
        await prisma.contract.updateMany({
          where: { organizationId: { in: orgIds } },
          data: { currentVersionId: null },
        });
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      }
      for (const key of storageKeys) await storage.delete(key).catch(() => undefined);
    } catch {}
    await emailQueue.close().catch(() => undefined);
    await prisma.$disconnect();
    const redis = getRedisConnection();
    await redis.quit().catch(() => redis.disconnect());
  }
});
