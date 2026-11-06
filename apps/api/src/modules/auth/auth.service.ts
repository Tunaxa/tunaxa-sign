import prisma from "@axa-sign/database";
import { hashPassword, verifyPassword, generateTokenPair, verifyToken } from "@axa-sign/auth";
import { ConflictError, UnauthorizedError, NotFoundError, generateId } from "@axa-sign/shared";
import type { JwtPayload } from "@axa-sign/auth";

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const slug = input.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: `${slug}-${generateId("org")}`,
        },
      });

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: "OWNER",
          organizationId: org.id,
        },
      });

      return { user, organization: org };
    });

    const tokens = generateTokenPair({
      sub: result.user.id,
      email: result.user.email,
      organizationId: result.organization.id,
      role: result.user.role,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokenPair({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = verifyToken(refreshToken) as JwtPayload & { type?: string };
      if (payload.type !== "refresh") {
        throw new UnauthorizedError("Invalid refresh token");
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { organization: true },
      });

      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      const tokens = generateTokenPair({
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      });

      return tokens;
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) throw new NotFoundError("User", userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
      },
    };
  }
}
