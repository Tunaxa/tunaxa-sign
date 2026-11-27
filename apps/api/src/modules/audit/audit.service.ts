import prisma from "@axa-sign/database";
import { paginate, paginationMeta } from "@axa-sign/shared";
import {
  buildAuditEventData,
  computeAuditEventHash,
  verifyAuditChain,
  type AuditEvent,
} from "@axa-sign/domain";

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
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.organizationId}::text))::text AS lock_result`;

        const lastEvent = await tx.auditEvent.findFirst({
          where: { organizationId: data.organizationId },
          orderBy: { sequence: "desc" },
        });
        const sequence = (lastEvent?.sequence ?? 0) + 1;
        const eventData = buildAuditEventData(data);
        const hash = computeAuditEventHash(data, lastEvent?.hash);

        return tx.auditEvent.create({
          data: {
            ...eventData,
            sequence,
            hash,
            previousHash: lastEvent?.hash,
          },
        });
      }, { timeout: 10000 });
    } catch (error) {
      if (error instanceof Error && /lock timeout/i.test(error.message)) {
        throw new Error(
          `Audit append for organization ${data.organizationId} timed out after 5s waiting for the organization lock`
        );
      }
      throw error;
    }
  }

  async getContractAudit(organizationId: string, contractId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);

    const where = { organizationId, contractId };

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take,
        orderBy: { sequence: "asc" },
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
        orderBy: { sequence: "desc" },
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
