import { createWorker } from "@axa-sign/queue";
import type { CleanupJob } from "@axa-sign/queue";
import prisma from "@axa-sign/database";

export function startCleanupWorker() {
  const worker = createWorker<CleanupJob>(
    "cleanup",
    async (job) => {
      const { type, olderThanDays } = job.data;
      const days = olderThanDays || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      console.log(`[CleanupWorker] Running cleanup: ${type} (older than ${days} days)`);

      switch (type) {
        case "expired_sessions": {
          const result = await prisma.signingSession.deleteMany({
            where: {
              expiresAt: { lt: new Date() },
              completedAt: null,
            },
          });
          console.log(`[CleanupWorker] Deleted ${result.count} expired sessions`);
          return { deleted: result.count };
        }

        case "old_documents": {
          // Delete orphaned documents
          const result = await prisma.document.deleteMany({
            where: {
              createdAt: { lt: cutoff },
              versions: { none: {} },
            },
          });
          console.log(`[CleanupWorker] Deleted ${result.count} old documents`);
          return { deleted: result.count };
        }

        case "webhook_retries": {
          const result = await prisma.webhookDelivery.deleteMany({
            where: {
              createdAt: { lt: cutoff },
              status: "FAILED",
              attempts: { gte: 3 },
            },
          });
          console.log(`[CleanupWorker] Deleted ${result.count} failed webhook deliveries`);
          return { deleted: result.count };
        }

        default:
          return { skipped: true };
      }
    },
    { concurrency: 1 }
  );

  return worker;
}
