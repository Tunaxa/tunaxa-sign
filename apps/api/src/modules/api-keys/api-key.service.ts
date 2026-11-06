import prisma from "@axa-sign/database";
import { generateToken, generateId, hashToken, NotFoundError, ConflictError } from "@axa-sign/shared";

const API_KEY_PREFIX = "axa_";

export class ApiKeyService {
  async create(
    organizationId: string,
    name: string,
    permissions: string[],
    expiresAt?: Date
  ) {
    const token = `${API_KEY_PREFIX}${generateToken(32)}`;
    const keyHash = hashToken(token);
    const prefix = token.slice(0, 12);

    // Enforce max 10 API keys per org
    const count = await prisma.apiKey.count({
      where: { organizationId, revokedAt: null },
    });
    if (count >= 10) {
      throw new ConflictError("Organization has reached the API key limit (10)");
    }

    const key = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        prefix,
        permissions,
        organizationId,
        expiresAt,
      },
    });

    // Return full key only once — never stored again
    return {
      id: key.id,
      name: key.name,
      key: token,
      prefix: key.prefix,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      warning: "Save this API key now — it will not be shown again",
    };
  }

  async list(organizationId: string) {
    return prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revoke(organizationId: string, keyId: string) {
    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, organizationId },
    });
    if (!key) throw new NotFoundError("API key", keyId);

    if (key.revokedAt) {
      throw new ConflictError("API key already revoked");
    }

    return prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        prefix: true,
        revokedAt: true,
      },
    });
  }

  async delete(organizationId: string, keyId: string) {
    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, organizationId },
    });
    if (!key) throw new NotFoundError("API key", keyId);

    await prisma.apiKey.delete({ where: { id: keyId } });
  }

  async validate(key: string): Promise<{ organizationId: string; permissions: string[] } | null> {
    const keyHash = hashToken(key);
    const record = await prisma.apiKey.findUnique({ where: { keyHash } });

    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt && new Date() > record.expiresAt) return null;

    // Update last used
    await prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      organizationId: record.organizationId,
      permissions: record.permissions as string[],
    };
  }
}