import prisma from "@axa-sign/database";
import { sha256, paginate, paginationMeta } from "@axa-sign/shared";
import { verifyAuditChain, type AuditEvent } from "@axa-sign/domain";

export class AuditService {
  async recordEvent(data: {
    type: string;
    organizationId: string;
    contractId?: string;
    userId?: string;
    data?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Get previous hash for chain
    const lastEvent = await prisma.auditEvent.findFirst({
      where: { organizationId: data.organizationId },
      orderBy: { createdAt: "desc" },
    });

    const eventData = {
      type: data.type,
      data: JSON.parse(JSON.stringify(data.data || {})),
      organizationId: data.organizationId,
      contractId: data.contractId,
      userId: data.userId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    };

    const hashData = JSON.stringify(eventData) + (lastEvent?.hash || "");
    const hash = sha256(hashData);

    return prisma.auditEvent.create({
      data: {
        ...eventData,
        hash,
        previousHash: lastEvent?.hash,
      },
    });
  }

  async getContractAudit(organizationId: string, contractId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);

    const where = { organizationId, contractId };

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    const chainValid = verifyAuditChain(events as unknown as AuditEvent[]);

    return {
      events,
      pagination: paginationMeta(total, page, limit),
      chainValid: chainValid.isValid,
      brokenAt: chainValid.brokenAt,
    };
  }

  async getOrganizationAudit(organizationId: string, query: { page?: number; limit?: number; type?: string }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);

    const where: any = { organizationId };
    if (query.type) where.type = query.type;

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          contract: { select: { id: true, title: true } },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return { data: events, pagination: paginationMeta(total, page, limit) };
  }
}
