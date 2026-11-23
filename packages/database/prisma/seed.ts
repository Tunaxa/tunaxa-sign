import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://tunaxa:axa_secret@localhost:5432/axa_sign?schema=public",
    },
  },
});

async function main() {
  const hash = await argon2.hash("Password123!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const org = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Organization",
      slug: "demo-org",
      plan: "ENTERPRISE",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@tunaxa.com" },
    update: { passwordHash: hash },
    create: {
      email: "admin@tunaxa.com",
      passwordHash: hash,
      firstName: "Admin",
      lastName: "Tunaxa",
      role: "OWNER",
      organizationId: org.id,
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: "user@tunaxa.com" },
    update: { passwordHash: hash },
    create: {
      email: "user@tunaxa.com",
      passwordHash: hash,
      firstName: "Demo",
      lastName: "User",
      role: "MEMBER",
      organizationId: org.id,
      status: "ACTIVE",
    },
  });

  console.log("Seeding successful!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
