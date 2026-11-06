import prisma from "@axa-sign/database";
import { NotFoundError, paginate, paginationMeta } from "@axa-sign/shared";

export class UserService {
  async list(organizationId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);

    const where = { organizationId };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, pagination: paginationMeta(total, page, limit) };
  }

  async getById(organizationId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        team: { select: { id: true, name: true } },
      },
    });

    if (!user) throw new NotFoundError("User", userId);
    return user;
  }

  async updateRole(organizationId: string, userId: string, role: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) throw new NotFoundError("User", userId);

    return prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }
}
