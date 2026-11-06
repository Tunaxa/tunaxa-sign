import { createWorker } from "@axa-sign/queue";
import type { AuditJob } from "@axa-sign/queue";
import { sha256 } from "@axa-sign/shared";
import prisma from "@axa-sign/database";

export function startAuditWorker() {
  const worker = createWorker<AuditJob>(
    "audit",
    async (job) => {
      const { eventId, organizationId, contractId } = job.data;

      console.log(`[AuditWorker] Processing audit event ${eventId}`);

      // Get previous hash for chain integrity
      const lastEvent = await prisma.auditEvent.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      const event = await prisma.auditEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        console.error(`[AuditWorker] Event ${eventId} not found`);
        return { skipped: true };
      }

      // Compute chain hash
      const hashData = JSON.stringify({
        type: event.type,
        data: event.data,
        contractId: event.contractId,
      }) + (lastEvent?.hash || "");

      const hash = sha256(hashData);

      await prisma.auditEvent.update({
        where: { id: eventId },
        data: {
          hash,
          previousHash: lastEvent?.hash,
        },
      });

      return { verified: true };
    },
    { concurrency: 2 }
  );

  return worker;
}
