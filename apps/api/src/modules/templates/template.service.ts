import prisma from "@axa-sign/database";
import { NotFoundError, paginate, paginationMeta, generateId } from "@axa-sign/shared";
import type { CreateTemplateInput, CreateTemplateFieldInput } from "@axa-sign/domain";

export class TemplateService {
  async create(organizationId: string, input: CreateTemplateInput) {
    return prisma.template.create({
      data: {
        ...input,
        organizationId,
      },
    });
  }

  async list(organizationId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);

    const where = { organizationId };

    const [data, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { fields: true, roles: true, contracts: true } },
        },
      }),
      prisma.template.count({ where }),
    ]);

    return { data, pagination: paginationMeta(total, page, limit) };
  }

  async getById(organizationId: string, templateId: string) {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
      include: {
        fields: true,
        roles: true,
        contracts: true,
        versions: { orderBy: { version: "desc" }, take: 5 },
      },
    });
    if (!template) throw new NotFoundError("Template", templateId);
    return template;
  }

  async addField(
    organizationId: string,
    templateId: string,
    input: CreateTemplateFieldInput
  ) {
    const template = await this.getById(organizationId, templateId);

    return prisma.templateField.create({
      data: {
        ...input,
        config: input.config ? JSON.parse(JSON.stringify(input.config)) : undefined,
        templateId,
      },
    });
  }

  async addRole(organizationId: string, templateId: string, name: string) {
    await this.getById(organizationId, templateId);

    return prisma.templateRole.create({
      data: { name, templateId },
    });
  }

  async delete(organizationId: string, templateId: string) {
    const template = await this.getById(organizationId, templateId);

    if (template.contracts.length > 0) {
      throw new Error("Cannot delete template with existing contracts");
    }

    await prisma.template.delete({ where: { id: templateId } });
  }
}
