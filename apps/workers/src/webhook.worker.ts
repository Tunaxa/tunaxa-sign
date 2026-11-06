import { createWorker } from "@axa-sign/queue";
import type { WebhookJob } from "@axa-sign/queue";
import { createHmac } from "crypto";
import prisma from "@axa-sign/database";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function startWebhookWorker() {
  const worker = createWorker<WebhookJob>(
    "webhooks",
    async (job) => {
      const { endpointId, event, payload, webhookDeliveryId } = job.data;

      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: endpointId },
      });

      if (!endpoint || !endpoint.active) {
        console.log(`[WebhookWorker] Endpoint ${endpointId} not found or inactive`);
        return { skipped: true };
      }

      console.log(`[WebhookWorker] Delivering ${event} to ${endpoint.url}`);

      const body = JSON.stringify({
        event,
        data: payload,
        timestamp: new Date().toISOString(),
        deliveryId: webhookDeliveryId,
      });

      const signature = createHmac("sha256", endpoint.secret || WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AXA-Signature": signature,
            "X-AXA-Event": event,
            "X-AXA-Delivery-ID": webhookDeliveryId,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        await prisma.webhookDelivery.update({
          where: { id: webhookDeliveryId },
          data: {
            statusCode: response.status,
            response: await response.text().catch(() => ""),
            status: response.ok ? "DELIVERED" : "FAILED",
            deliveredAt: response.ok ? new Date() : null,
            attempts: { increment: 1 },
          },
        });

        return { success: response.ok };
      } catch (error) {
        await prisma.webhookDelivery.update({
          where: { id: webhookDeliveryId },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
            attempts: { increment: 1 },
          },
        });
        throw error;
      }
    },
    { concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
