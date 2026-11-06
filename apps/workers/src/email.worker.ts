import { createWorker } from "@axa-sign/queue";
import type { EmailJob } from "@axa-sign/queue";
import { sendEmail } from "@axa-sign/notifications";
import prisma from "@axa-sign/database";

export function startEmailWorker() {
  const worker = createWorker<EmailJob>(
    "email",
    async (job) => {
      const { to, subject, html, notificationId } = job.data;

      console.log(`[EmailWorker] Sending email to ${to}`);

      const success = await sendEmail({ to, subject, html });

      if (notificationId) {
        await prisma.notificationDelivery.update({
          where: { id: notificationId },
          data: {
            status: success ? "SENT" : "FAILED",
            sentAt: success ? new Date() : null,
            error: success ? null : "Failed to send email",
            attempts: { increment: 1 },
          },
        });
      }

      return { success };
    },
    { concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
