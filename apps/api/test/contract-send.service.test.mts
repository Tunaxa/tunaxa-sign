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
const { hashToken } = await import("@axa-sign/shared");
const { emailQueue, getRedisConnection } = await import("@axa-sign/queue");
const { ContractService } = await import(
  "../src/modules/contracts/contract.service.js"
);

const SESSION_EXPIRY_HOURS = 72;

async function createContract(
  organizationId: string,
  userId: string,
  title: string
) {
  return prisma.contract.create({
    data: { title, organizationId, createdBy: userId },
  });
}

async function attachVersion(
  organizationId: string,
  contractId: string,
  userId: string,
  suffix: string,
  documentIds: string[]
) {
  const document = await prisma.document.create({
    data: {
      name: `tun2-79-${suffix}.pdf`,
      mimeType: "application/pdf",
      size: 128,
      sha256: "a".repeat(64),
      storageKey: `test/tun2-79/${suffix}.pdf`,
      organizationId,
    },
  });
  documentIds.push(document.id);

  const version = await prisma.contractVersion.create({
    data: {
      contractId,
      version: 1,
      documentId: document.id,
      sha256: document.sha256,
      isCurrent: true,
      createdBy: userId,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { currentVersionId: version.id },
  });

  return version;
}

async function addParticipant(
  contractId: string,
  suffix: string,
  type: "SIGNER" | "APPROVER" | "CC" | "VIEWER"
) {
  return prisma.participant.create({
    data: {
      contractId,
      name: `TUN2-79 ${type} ${suffix}`,
      email: `tun2-79-${type.toLowerCase()}-${suffix}@example.test`,
      type,
      signingOrder: 0,
    },
  });
}

test("TUN2-79: contract send creates sessions, steps and invites", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const service = new ContractService();
  const organizationIds: string[] = [];
  const documentIds: string[] = [];
  const queuedNotificationIds: string[] = [];

  try {
    const organization = await prisma.organization.create({
      data: { name: `TUN2-79 ${suffix}`, slug: `tun2-79-${suffix}` },
    });
    organizationIds.push(organization.id);

    const user = await prisma.user.create({
      data: {
        email: `tun2-79-${suffix}@example.test`,
        passwordHash: "not-used",
        firstName: "TUN2",
        lastName: "SeventyNine",
        organizationId: organization.id,
      },
    });

    await t.test("sends a valid DRAFT contract and creates a hashed session", async () => {
      const contract = await createContract(
        organization.id,
        user.id,
        `TUN2-79 valid ${suffix}`
      );
      await attachVersion(
        organization.id,
        contract.id,
        user.id,
        `${suffix}-valid`,
        documentIds
      );
      const signer = await addParticipant(contract.id, `${suffix}-valid`, "SIGNER");
      const approver = await addParticipant(
        contract.id,
        `${suffix}-valid`,
        "APPROVER"
      );

      const updated = await service.send(
        organization.id,
        contract.id,
        user.id
      );

      assert.equal(updated.status, "SENT");
      assert.ok(updated.sentAt);

      const sessions = await prisma.signingSession.findMany({
        where: { participantId: { in: [signer.id, approver.id] } },
      });
      assert.equal(sessions.length, 2);

      for (const session of sessions) {
        assert.match(session.tokenHash, /^[a-f0-9]{64}$/);
        const expectedExpiry =
          Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
        assert.ok(
          Math.abs(session.expiresAt.getTime() - expectedExpiry) <
            5 * 60 * 1000
        );
      }

      const steps = await prisma.signingStep.findMany({
        where: { contractId: contract.id },
        orderBy: { step: "asc" },
      });
      assert.deepEqual(
        steps.map((step) => step.type),
        ["SIGN", "APPROVE"]
      );
      assert.ok(steps.every((step) => step.status === "WAITING"));

      const notifications = await prisma.notification.findMany({
        where: {
          organizationId: organization.id,
          type: "CONTRACT_INVITATION",
        },
        include: { deliveries: true },
      });
      assert.equal(notifications.length, 2);
      assert.ok(
        notifications.every(
          (notification) =>
            notification.body.includes("[signing link]") &&
            !notification.body.includes("/session/")
        )
      );

      const jobs = await emailQueue.getJobs(
        ["waiting", "active", "completed"],
        0,
        100,
        true
      );
      const inviteJobs = jobs.filter((job: any) =>
        notifications.some(
          (notification) =>
            notification.deliveries[0]?.id === job.data.notificationId
        )
      );
      assert.equal(inviteJobs.length, 2);
      for (const job of inviteJobs) {
        queuedNotificationIds.push(job.data.notificationId);

        const match = String((job as any).data.html).match(
          /\/session\/([a-f0-9]{64})/
        );
        assert.ok(match);
        const rawToken = match![1];

        const session = sessions.find(
          (candidate) => candidate.tokenHash === hashToken(rawToken)
        );
        assert.ok(session);
        assert.notEqual(session!.tokenHash, rawToken);

        await (job as any).remove().catch(() => undefined);
      }

      const auditEvents = await prisma.auditEvent.findMany({
        where: { contractId: contract.id, type: "contract.sent" },
      });
      assert.equal(auditEvents.length, 1);
      assert.equal(auditEvents[0].userId, user.id);
    });

    await t.test("rejects a contract without a current document", async () => {
      const contract = await createContract(
        organization.id,
        user.id,
        `TUN2-79 no document ${suffix}`
      );
      const signer = await addParticipant(
        contract.id,
        `${suffix}-nodoc`,
        "SIGNER"
      );

      await assert.rejects(
        () => service.send(organization.id, contract.id, user.id),
        (error: any) =>
          error.statusCode === 400 && /current document/.test(error.message)
      );

      const after = await prisma.contract.findUnique({
        where: { id: contract.id },
      });
      assert.equal(after!.status, "DRAFT");
      assert.equal(after!.currentVersionId, null);
      assert.equal(
        await prisma.signingSession.count({
          where: { participantId: signer.id },
        }),
        0
      );
      assert.equal(
        await prisma.signingStep.count({ where: { contractId: contract.id } }),
        0
      );
      assert.equal(
        await prisma.auditEvent.count({ where: { contractId: contract.id } }),
        0
      );
    });

    await t.test("rejects a contract without a SIGNER participant", async () => {
      const contract = await createContract(
        organization.id,
        user.id,
        `TUN2-79 no signer ${suffix}`
      );
      await attachVersion(
        organization.id,
        contract.id,
        user.id,
        `${suffix}-nosigner`,
        documentIds
      );
      const viewer = await addParticipant(
        contract.id,
        `${suffix}-nosigner`,
        "VIEWER"
      );

      await assert.rejects(
        () => service.send(organization.id, contract.id, user.id),
        (error: any) =>
          error.statusCode === 400 && /type SIGNER/.test(error.message)
      );

      const after = await prisma.contract.findUnique({
        where: { id: contract.id },
      });
      assert.equal(after!.status, "DRAFT");
      assert.equal(
        await prisma.signingSession.count({
          where: { participantId: viewer.id },
        }),
        0
      );
      assert.equal(
        await prisma.signingStep.count({ where: { contractId: contract.id } }),
        0
      );
    });

    await t.test("rejects a second send with 409 and does not duplicate", async () => {
      const contract = await createContract(
        organization.id,
        user.id,
        `TUN2-79 twice ${suffix}`
      );
      await attachVersion(
        organization.id,
        contract.id,
        user.id,
        `${suffix}-twice`,
        documentIds
      );
      const signer = await addParticipant(
        contract.id,
        `${suffix}-twice`,
        "SIGNER"
      );

      await service.send(organization.id, contract.id, user.id);

      await assert.rejects(
        () => service.send(organization.id, contract.id, user.id),
        (error: any) =>
          error.statusCode === 409 && /DRAFT status/.test(error.message)
      );

      const sessions = await prisma.signingSession.findMany({
        where: { participantId: signer.id },
      });
      assert.equal(sessions.length, 1);
      const stepCount = await prisma.signingStep.count({
        where: { contractId: contract.id, participantId: signer.id },
      });
      assert.equal(stepCount, 1);
      assert.equal(
        await prisma.auditEvent.count({
          where: { contractId: contract.id, type: "contract.sent" },
        }),
        1
      );
    });

    await t.test("returns 404 for another organization's contract", async () => {
      const otherOrganization = await prisma.organization.create({
        data: {
          name: `TUN2-79 Other ${suffix}`,
          slug: `tun2-79-other-${suffix}`,
        },
      });
      organizationIds.push(otherOrganization.id);

      const otherUser = await prisma.user.create({
        data: {
          email: `tun2-79-other-${suffix}@example.test`,
          passwordHash: "not-used",
          firstName: "Other",
          lastName: "User",
          organizationId: otherOrganization.id,
        },
      });

      const otherContract = await createContract(
        otherOrganization.id,
        otherUser.id,
        `TUN2-79 other ${suffix}`
      );
      await attachVersion(
        otherOrganization.id,
        otherContract.id,
        otherUser.id,
        `${suffix}-other`,
        documentIds
      );
      const otherSigner = await addParticipant(
        otherContract.id,
        `${suffix}-other`,
        "SIGNER"
      );

      await assert.rejects(
        () => service.send(organization.id, otherContract.id, user.id),
        (error: any) =>
          error.statusCode === 404 && /not found/i.test(error.message)
      );

      const after = await prisma.contract.findUnique({
        where: { id: otherContract.id },
      });
      assert.equal(after!.status, "DRAFT");
      assert.equal(
        await prisma.signingSession.count({
          where: { participantId: otherSigner.id },
        }),
        0
      );
    });

    await t.test("rolls back status, steps and sessions on failure", async () => {
      const contract = await createContract(
        organization.id,
        user.id,
        `TUN2-79 atomic ${suffix}`
      );
      const version = await attachVersion(
        organization.id,
        contract.id,
        user.id,
        `${suffix}-atomic`,
        documentIds
      );
      const signer = await addParticipant(
        contract.id,
        `${suffix}-atomic`,
        "SIGNER"
      );

      await prisma.signingStep.create({
        data: {
          contractId: contract.id,
          participantId: signer.id,
          step: 1,
          type: "SIGN",
          status: "PENDING",
        },
      });

      const notificationsBefore = await prisma.notification.count({
        where: { organizationId: organization.id },
      });

      await assert.rejects(() =>
        service.send(organization.id, contract.id, user.id)
      );

      const after = await prisma.contract.findUnique({
        where: { id: contract.id },
      });
      assert.equal(after!.status, "DRAFT");
      assert.equal(after!.sentAt, null);
      assert.equal(after!.currentVersionId, version.id);
      assert.equal(
        await prisma.signingSession.count({
          where: { participantId: signer.id },
        }),
        0
      );
      assert.equal(
        await prisma.signingStep.count({ where: { contractId: contract.id } }),
        1
      );
      assert.equal(
        await prisma.notification.count({
          where: { organizationId: organization.id },
        }),
        notificationsBefore
      );
      assert.equal(
        await prisma.auditEvent.count({ where: { contractId: contract.id } }),
        0
      );
    });
  } finally {
    try {
      const notifications =
        organizationIds.length > 0
          ? await prisma.notification.findMany({
              where: { organizationId: { in: organizationIds } },
              include: { deliveries: true },
            })
          : [];
      const deliveryIds = new Set(
        notifications.flatMap((notification) =>
          notification.deliveries.map((delivery) => delivery.id)
        )
      );

      const jobs = await emailQueue.getJobs(
        ["waiting", "active", "completed", "delayed", "paused", "failed"],
        0,
        200,
        true
      );
      for (const job of jobs as any[]) {
        if (
          queuedNotificationIds.includes(job.data?.notificationId) ||
          deliveryIds.has(job.data?.notificationId)
        ) {
          await job.remove().catch(() => undefined);
        }
      }
    } catch {}

    for (const id of organizationIds) {
      try {
        await prisma.organization.delete({ where: { id } });
      } catch {}
    }

    if (documentIds.length > 0) {
      try {
        await prisma.document.deleteMany({
          where: { id: { in: documentIds } },
        });
      } catch {}
    }

    await emailQueue.close().catch(() => undefined);
    await getRedisConnection().quit().catch(() => undefined);
    await prisma.$disconnect();
  }
});
