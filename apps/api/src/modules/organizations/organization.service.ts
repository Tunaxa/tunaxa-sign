import prisma from "@axa-sign/database";
import { NotFoundError } from "@axa-sign/shared";

export class OrganizationService {
  async getProfile(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            users: true,
            contracts: true,
            templates: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundError("Organization", organizationId);
    return org;
  }

  async updateSettings(organizationId: string, settings: Record<string, unknown>) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundError("Organization", organizationId);

    const currentSettings = (org.settings as Record<string, unknown>) || {};

    return prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: JSON.parse(JSON.stringify({ ...currentSettings, ...settings })),
      },
    });
  }

  async getStats(organizationId: string) {
    const [contracts, users, templates, completedContracts] = await Promise.all([
      prisma.contract.count({ where: { organizationId } }),
      prisma.user.count({ where: { organizationId } }),
      prisma.template.count({ where: { organizationId } }),
      prisma.contract.count({ where: { organizationId, status: "COMPLETED" } }),
    ]);

    return {
      contracts,
      users,
      templates,
      completedContracts,
      completionRate: contracts > 0 ? (completedContracts / contracts) * 100 : 0,
    };
  }
}
