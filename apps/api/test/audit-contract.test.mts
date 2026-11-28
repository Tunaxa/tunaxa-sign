/**
 * AXS-014 — Audit endpoint filtered by contract
 *
 * Tests GET /api/v1/audit?contractId=<id> and ensures unfiltered GET /api/v1/audit
 * continues to work as before.
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
const { signAccessToken } = await import("@axa-sign/auth");
const { emailQueue, getRedisConnection } = await import("@axa-sign/queue");
const { app } = await import("../src/app.js");
const { AuditService } = await import("../src/modules/audit/audit.service.js");

const createdOrgIds: string[] = [];

async function seedOrg(label: string) {
  const org = await prisma.organization.create({
    data: {
      name: label,
      slug: `axs014-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    },
  });
  createdOrgIds.push(org.id);
  return org;
}

async function seedUser(organizationId: string, label: string) {
  return prisma.user.create({
    data: {
      email: `axs014-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.invalid`,
      firstName: "Audit",
      lastName: label,
      passwordHash: "x",
      organizationId,
      role: "ADMIN",
    },
  });
}

async function seedContract(organizationId: string, userId: string, title: string) {
  return prisma.contract.create({
    data: {
      title,
      organizationId,
      createdBy: userId,
      source: "MANUAL",
    },
  });
}

await test("AXS-014: GET /api/v1/audit?contractId= timeline, pagination, scoping, and validation", async (t) => {
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

  const orgA = await seedOrg("orgA");
  const orgB = await seedOrg("orgB");
  const userA = await seedUser(orgA.id, "UserA");
  const userB = await seedUser(orgB.id, "UserB");

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

  const contract1 = await seedContract(orgA.id, userA.id, "Contract One");
  const contract2 = await seedContract(orgA.id, userA.id, "Contract Two");
  const emptyContract = await seedContract(orgA.id, userA.id, "Empty Contract");
  const orgBContract = await seedContract(orgB.id, userB.id, "Org B Contract");

  const auditService = new AuditService();

  // Record 3 events on contract1 (including user and system actors) and 1 on contract2
  const ev1 = await auditService.recordEvent({
    type: "contract.created",
    organizationId: orgA.id,
    contractId: contract1.id,
    userId: userA.id,
    ipAddress: "203.0.113.10",
    userAgent: "Mozilla/5.0",
    data: { secretInternal: "should-not-leak" },
  });

  const ev2 = await auditService.recordEvent({
    type: "contract.sent",
    organizationId: orgA.id,
    contractId: contract1.id,
    ipAddress: "203.0.113.11",
    data: { tokenPreview: "internal-value" },
  });

  const ev3 = await auditService.recordEvent({
    type: "participant.invited",
    organizationId: orgA.id,
    contractId: contract1.id,
    userId: userA.id,
    data: { participantId: "p-1" },
  });

  await auditService.recordEvent({
    type: "contract.created",
    organizationId: orgA.id,
    contractId: contract2.id,
    userId: userA.id,
  });

  // Force ev1 and ev2 to share the exact same createdAt timestamp to test stable sequence ordering
  const sameTs = new Date("2026-11-28T12:00:00.000Z");
  await prisma.$executeRaw`UPDATE "audit_events" SET "createdAt" = ${sameTs} WHERE id IN (${ev1.id}, ${ev2.id})`;

  // 1. Returns only events of requested contract, in ascending order, with stable tie-breaker
  const res1 = await fetch(`${baseUrl}/api/v1/audit?contractId=${contract1.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const body1 = (await res1.json()) as any;
  assert.equal(res1.status, 200, `Expected 200, got ${res1.status}: ${JSON.stringify(body1)}`);
  assert.equal(body1.data.length, 3);
  assert.equal(body1.pagination.total, 3);
  assert.deepEqual(
    body1.data.map((e: any) => e.id),
    [ev1.id, ev2.id, ev3.id]
  );

  // 2. Response contains only allowed fields and NO hash, previousHash, userAgent, or raw data
  const first = body1.data[0];
  assert.deepEqual(Object.keys(first).sort(), ["actor", "id", "ipAddress", "timestamp", "type"]);
  assert.equal(first.timestamp, sameTs.toISOString());
  assert.deepEqual(first.actor, {
    type: "user",
    name: "Audit UserA",
    email: userA.email,
  });
  assert.equal(first.ipAddress, "203.0.113.10");
  assert.equal("hash" in first, false);
  assert.equal("previousHash" in first, false);
  assert.equal("userAgent" in first, false);
  assert.equal("data" in first, false);

  const second = body1.data[1];
  assert.deepEqual(second.actor, { type: "system", name: null, email: null });

  // 3. Pagination: page 2 returns next events, total is correct
  const resPage2 = await fetch(
    `${baseUrl}/api/v1/audit?contractId=${contract1.id}&page=2&limit=2`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert.equal(resPage2.status, 200);
  const bodyPage2 = (await resPage2.json()) as any;
  assert.equal(bodyPage2.data.length, 1);
  assert.equal(bodyPage2.data[0].id, ev3.id);
  assert.equal(bodyPage2.pagination.total, 3);
  assert.equal(bodyPage2.pagination.page, 2);
  assert.equal(bodyPage2.pagination.limit, 2);

  // 4. Size above max (100) and negative page are rejected with 400
  const resOverMax = await fetch(
    `${baseUrl}/api/v1/audit?contractId=${contract1.id}&limit=101`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert.equal(resOverMax.status, 400);

  const resNegPage = await fetch(
    `${baseUrl}/api/v1/audit?contractId=${contract1.id}&page=-1`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert.equal(resNegPage.status, 400);

  // 5. Invalid contractId returns 400
  const resBadId = await fetch(`${baseUrl}/api/v1/audit?contractId=not-a-cuid`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resBadId.status, 400);

  // 6. Contract from another organization returns 404
  const resCrossOrg = await fetch(`${baseUrl}/api/v1/audit?contractId=${orgBContract.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resCrossOrg.status, 404);

  // 7. Contract with no events returns an empty list
  const resEmpty = await fetch(`${baseUrl}/api/v1/audit?contractId=${emptyContract.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resEmpty.status, 200);
  const bodyEmpty = (await resEmpty.json()) as any;
  assert.deepEqual(bodyEmpty.data, []);
  assert.equal(bodyEmpty.pagination.total, 0);

  // 8. Existing unfiltered /audit call still works as before
  const resUnfiltered = await fetch(`${baseUrl}/api/v1/audit`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resUnfiltered.status, 200);
  const bodyUnfiltered = (await resUnfiltered.json()) as any;
  assert.equal(bodyUnfiltered.data.length, 4);
  assert.equal(bodyUnfiltered.pagination.total, 4);
  assert.ok("hash" in bodyUnfiltered.data[0]);
});

test.after(async () => {
  try {
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
  } catch {}
  await emailQueue.close().catch(() => undefined);
  const redis = getRedisConnection();
  await redis.quit().catch(() => redis.disconnect());
  await prisma.$disconnect();
});
