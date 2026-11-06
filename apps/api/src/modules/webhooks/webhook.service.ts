import prisma from "@axa-sign/database";
import { generateId, hashToken, NotFoundError, ConflictError } from "@axa-sign/shared";

export class WebhookService {
  async createEndpoint(
    organizationId: string,
    url: string,
    events: string[]
  ) {
    const secret = generateId("whsec");

    return prisma.webhookEndpoint.create({
      data: {
        url,
        secret,
        events,
        organizationId,
      },
    });
  }

  async listEndpoints(organizationId: string) {
    return prisma.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
      },
    });
  }

  async deleteEndpoint(organizationId: string, endpointId: string) {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId },
    });
    if (!endpoint) throw new NotFoundError("Webhook endpoint", endpointId);

    await prisma.webhookEndpoint.delete({ where: { id: endpointId } });
  }

  async getDeliveries(organizationId: string, endpointId: string) {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId },
    });
    if (!endpoint) throw new NotFoundError("Webhook endpoint", endpointId);

    return prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
