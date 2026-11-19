import { eventBus, type DomainEvent } from "@axa-sign/events";
import { emailQueue, webhookQueue } from "@axa-sign/queue";
import { contractCompletedEmail } from "@axa-sign/notifications";
import prisma from "@axa-sign/database";
import type { CertificateService } from "../modules/certificates/certificate.service";

/**
 * Wires the domain event bus to side effects.
 * Registered once at API boot.
 */
export function registerEventHandlers(certificateService: CertificateService) {
  // ── Contract sent → webhook (sessions and invites are created by ContractService.send) ──
  eventBus.on("contract.sent", async (event) => {
    await emitWebhook(event, event.organizationId);
  });

  // ── Contract completed → generate certificate + CE email ──
  eventBus.on("contract.completed", async (event) => {
    // Generate certificate & evidence package
    await certificateService.generateForContract(event.contractId, event.organizationId);

    // Notify the sender
    const contract = await prisma.contract.findUnique({
      where: { id: event.contractId },
      include: {
        creator: true,
      },
    });

    if (contract) {
      const { subject, html } = contractCompletedEmail({
        recipientName: `${contract.creator.firstName} ${contract.creator.lastName}`,
        contractTitle: contract.title,
      });

      const notification = await prisma.notification.create({
        data: {
          type: "CONTRACT_COMPLETED",
          channel: "EMAIL",
          subject,
          body: html,
          organizationId: contract.organizationId,
          deliveries: {
            create: { recipientEmail: contract.creator.email },
          },
        },
        include: { deliveries: true },
      });

      await emailQueue.add(
        "send",
        {
          to: contract.creator.email,
          subject,
          html,
          notificationId: notification.deliveries[0].id,
        },
        { attempts: 3 }
      );
    }

    await emitWebhook(event, event.organizationId);
  });

  // ── contract.created → webhook ──
  eventBus.on("contract.created", async (event) => {
    await emitWebhook(event, event.organizationId);
  });

  // ── participant.invited → webhook ──
  eventBus.on("participant.invited", async (event) => {
    await emitWebhook(event, event.organizationId);
  });

  // ── participant.signed → webhook ──
  eventBus.on("participant.signed", async (event) => {
    await emitWebhook(event, event.organizationId);
  });

  // ── certificate.generated → webhook ──
  eventBus.on("certificate.generated", async (event) => {
    await emitWebhook(event, event.organizationId);
  });

  console.log("[Events] Domain event handlers registered");
}

async function emitWebhook(event: DomainEvent, organizationId: string) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId, active: true, events: { has: event.type } },
  });

  for (const endpoint of endpoints) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event: event.type,
        payload: JSON.parse(JSON.stringify(event)),
      },
    });

    await webhookQueue.add(
      "deliver",
      {
        endpointId: endpoint.id,
        event: event.type,
        payload: event as unknown as Record<string, unknown>,
        webhookDeliveryId: delivery.id,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    );
  }
}