import prisma from "@axa-sign/database";
import { NotFoundError, paginate, paginationMeta } from "@axa-sign/shared";
import {
  buildAuditEventData,
  computeAuditEventHash,
} from "@axa-sign/domain";

export interface AuditTimelineActor {
  type: "user" | "system";
  name: string | null;
  email: string | null;
}

export interface AuditTimelineItem {
  id: string;
  type: string;
  timestamp: string;
  actor: AuditTimelineActor;
  ipAddress: string | null;
}

export function mapAuditEventToTimelineItem(event: {
  id: string;
  type: string;
  createdAt: Date;
  ipAddress: string | null;
  user: { firstName: string; lastName: string; email: string } | null;
}): AuditTimelineItem {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.createdAt.toISOString(),
    actor: event.user
      ? {
          type: "user",
          name: `${event.user.firstName} ${event.user.lastName}`,
          email: event.user.email,
        }
      : {
          type: "system",
          name: null,
          email: null,
        },
    ipAddress: event.ipAddress ?? null,
  };
}

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

  async getContractAudit(
    organizationId: string,
    contractId: string,
    query: { page?: number; limit?: number }
  ) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
      select: { id: true },
    });
    if (!contract) throw new NotFoundError("Contract", contractId);

    const { skip, take, page, limit } = paginate(query.page, query.limit ?? 50);

    const where = { organizationId, contractId };

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take,
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          type: true,
          createdAt: true,
          ipAddress: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      data: events.map(mapAuditEventToTimelineItem),
      pagination: paginationMeta(total, page, limit),
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
