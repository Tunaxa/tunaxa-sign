import prisma from "@axa-sign/database";
import { generateId, NotFoundError, ConflictError } from "@axa-sign/shared";
import { eventBus } from "@axa-sign/events";

export interface TemplateVariable {
  key: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}

export interface TemplateEngineResult {
  contract: {
    id: string;
    title: string;
    status: string;
  };
  document: {
    id: string;
    name: string;
  };
  participants: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    type: string;
  }>;
  variables: Record<string, string>;
}

export class TemplateEngine {
  /**
   * Generates a contract from a template using the provided variables.
   * Flow: Template → Merge variables → Create Contract → Attach document → Create participants
   */
  async generateContractFromTemplate(
    organizationId: string,
    userId: string,
    templateId: string,
    variables: Record<string, string>,
    participants: Array<{
      email: string;
      name?: string;
      type?: "SIGNER" | "APPROVER" | "CC" | "VIEWER";
      role?: string;
      signingOrder?: number;
    }>,
    options?: { title?: string; expiresAt?: Date }
  ) {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
      include: {
        roles: true,
        versions: { orderBy: { version: "desc" }, take: 1 },
        fields: true,
      },
    });

    if (!template) throw new NotFoundError("Template", templateId);
    if (!template.isActive) throw new ConflictError("Template is not active");
    if (template.versions.length === 0) {
      throw new ConflictError("Template has no document version");
    }

    // Validate required variables against template config
    await this.validateVariables(template, variables);

    const templateVersion = template.versions[0];
    const sourceDocument = await prisma.document.findUnique({
      where: { id: templateVersion.documentId },
    });
    if (!sourceDocument) throw new NotFoundError("Template document");

    const title = options?.title || this.renderTitle(template.name, variables);

    // Create the contract in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          title,
          status: "DRAFT",
          source: "TEMPLATE",
          organizationId,
          createdBy: userId,
          templateId: template.id,
          expiresAt: options?.expiresAt,
        },
      });

      return { contract };
    });

    // Generate the contract document from template document
    const document = await this.generateDocument(
      sourceDocument,
      template,
      variables
    );

    // Attach document as Version 1
    await prisma.contractVersion.create({
      data: {
        contractId: result.contract.id,
        version: 1,
        documentId: document.id,
        sha256: this.computeHash(variables),
        isCurrent: true,
        createdBy: userId,
      },
    });

    await prisma.contract.update({
      where: { id: result.contract.id },
      data: { currentVersionId: document.id },
    });

    // Create participants
    const createdParticipants = [];
    for (const p of participants) {
      const role = p.role || "Signer";
      const participantType = p.type || "SIGNER";

      const participant = await prisma.participant.create({
        data: {
          contractId: result.contract.id,
          name: p.name || variables[`${role.toLowerCase()}.name`] || role,
          email: p.email,
          type: participantType,
          role,
          signingOrder: p.signingOrder || 0,
        },
      });
      createdParticipants.push(participant);
    }

    // Emit domain event
    await eventBus.emit({
      type: "contract.created",
      organizationId,
      contractId: result.contract.id,
      createdBy: userId,
      occurredAt: new Date(),
    });

    return {
      contract: {
        id: result.contract.id,
        title,
        status: "DRAFT",
      },
      document: {
        id: document.id,
        name: document.name,
      },
      participants: createdParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        type: p.type,
      })),
      variables,
    } as TemplateEngineResult;
  }

  /**
   * Creates a document on the storage layer that represents the merged
   * variables applied to the template document.
   */
  private async generateDocument(
    sourceDocument: any,
    template: any,
    variables: Record<string, string>
  ) {
    const newDocument = await prisma.document.create({
      data: {
        name: template.name.replace(/\s+/g, "-").toLowerCase() + ".pdf",
        mimeType: "application/pdf",
        size: sourceDocument.size,
        sha256: this.computeHash(variables),
        storageKey: sourceDocument.storageKey, // cloned reference for now
        metadata: {
          templateId: template.id,
          variables,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    return newDocument;
  }

  private async validateVariables(template: any, variables: Record<string, string>) {
    const templateConfig = (template as any).config as Record<string, unknown> | undefined;
    const requiredVars = (templateConfig?.variables as TemplateVariable[]) || [];

    for (const v of requiredVars) {
      if (v.required && !variables[v.key]) {
        throw new ConflictError(`Missing required variable: ${v.key}`);
      }
    }
  }

  private renderTitle(templateName: string, variables: Record<string, string>): string {
    let title = templateName;
    // Replace {{var}} patterns if present in template name
    const pattern = /\{\{([^}]+)\}\}/g;
    if (pattern.test(title)) {
      title = title.replace(pattern, (_, key: string) => variables[key] || "");
    }
    return title;
  }

  private computeHash(variables: Record<string, string>): string {
    const { createHash } = require("crypto");
    return createHash("sha256")
      .update(JSON.stringify(variables))
      .digest("hex");
  }
}