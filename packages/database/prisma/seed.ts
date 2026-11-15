import { FieldType } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { hashPassword } from "@axa-sign/auth";
import { sha256 } from "@axa-sign/shared";
import { createStorageClient, STORAGE_FOLDERS, type StorageClient } from "@axa-sign/storage";

import prisma from "../src/index";

const ORGANIZATION_NAME = "AXA Assurance France";
const ORGANIZATION_SLUG = "axa-assurance-france";
const ADMIN_EMAIL = "admin@axa.com";
const AGENT_EMAIL = "agent@axa.com";
const TEMPLATE_NAME = "Mutual Non-Disclosure Agreement";
const TEMPLATE_SEED_ID = "seed_nda_template_axa_fr";
const PDF_DATE = new Date("2026-01-01T00:00:00.000Z");

const TEMPLATE_FIELDS = [
  {
    name: "company_name",
    type: FieldType.TEXT,
    roleName: "Company Representative",
    x: 120,
    y: 156,
    width: 220,
    height: 24,
  },
  {
    name: "effective_date",
    type: FieldType.DATE,
    roleName: "Company Representative",
    x: 120,
    y: 196,
    width: 140,
    height: 24,
  },
  {
    name: "payment_amount",
    type: FieldType.NUMBER,
    roleName: "Client Signer",
    x: 120,
    y: 236,
    width: 140,
    height: 24,
  },
] as const;

function readSeedPassword(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 8) {
    throw new Error(
      `${name} is required and must be at least 8 characters. See .env.example for local dev defaults.`
    );
  }
  return value;
}

function assertSeedEnvironment() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_ALLOW_PRODUCTION !== "true"
  ) {
    throw new Error(
      "Refusing to seed production. Set SEED_ALLOW_PRODUCTION=true to override intentionally."
    );
  }
}

async function upsertOrganization() {
  return prisma.organization.upsert({
    where: { slug: ORGANIZATION_SLUG },
    update: {
      name: ORGANIZATION_NAME,
      plan: "ENTERPRISE",
    },
    create: {
      name: ORGANIZATION_NAME,
      slug: ORGANIZATION_SLUG,
      plan: "ENTERPRISE",
      settings: { seeded: true },
    },
  });
}

async function upsertUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "OWNER" | "MEMBER";
  organizationId: string;
}) {
  const passwordHash = await hashPassword(input.password);

  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      organizationId: input.organizationId,
      emailVerified: true,
    },
    create: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      organizationId: input.organizationId,
      emailVerified: true,
    },
  });
}

async function upsertTemplate(organizationId: string) {
  const existing = await prisma.template.findFirst({
    where: { organizationId, name: TEMPLATE_NAME },
  });

  const id = existing?.id ?? TEMPLATE_SEED_ID;

  return prisma.template.upsert({
    where: { id },
    update: {
      name: TEMPLATE_NAME,
      description: "Demo mutual non-disclosure agreement for AXA Assurance France.",
      category: "NDA",
      isActive: true,
      organizationId,
    },
    create: {
      id,
      name: TEMPLATE_NAME,
      description: "Demo mutual non-disclosure agreement for AXA Assurance France.",
      category: "NDA",
      isActive: true,
      organizationId,
    },
  });
}

async function upsertRole(templateId: string, name: string) {
  return prisma.templateRole.upsert({
    where: {
      templateId_name: { templateId, name },
    },
    update: {},
    create: { templateId, name },
  });
}

async function upsertField(input: {
  templateId: string;
  roleId: string;
  name: string;
  type: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const existing = await prisma.templateField.findFirst({
    where: { templateId: input.templateId, name: input.name },
  });

  const id = existing?.id ?? `seed_nda_field_${input.name}`;

  return prisma.templateField.upsert({
    where: { id },
    update: {
      name: input.name,
      type: input.type,
      required: true,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      page: 1,
      config: {},
      roleId: input.roleId,
    },
    create: {
      id,
      templateId: input.templateId,
      roleId: input.roleId,
      name: input.name,
      type: input.type,
      required: true,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      page: 1,
      config: {},
    },
  });
}

async function buildNdaPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Mutual Non-Disclosure Agreement");
  pdf.setAuthor(ORGANIZATION_NAME);
  pdf.setSubject("Demo NDA template");
  pdf.setCreator("AXA Sign seed");
  pdf.setProducer("AXA Sign seed");
  pdf.setCreationDate(PDF_DATE);
  pdf.setModificationDate(PDF_DATE);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);

  let y = 742;

  page.drawText("MUTUAL NON-DISCLOSURE AGREEMENT", {
    x: 50,
    y,
    size: 17,
    font: bold,
    color: rgb(0.05, 0.05, 0.12),
  });
  y -= 22;

  page.drawText("AXA Assurance France", {
    x: 50,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.1, 0.18),
  });
  y -= 20;

  page.drawText(
    "This Mutual Non-Disclosure Agreement (the \"Agreement\") is made effective as of",
    { x: 50, y, size: 9.5, font }
  );
  y -= 13;
  page.drawText("{{effective_date}} by and between AXA Assurance France (\"Company\") and", {
    x: 50,
    y,
    size: 9.5,
    font,
  });
  y -= 13;
  page.drawText("{{company_name}} (\"Client\").", { x: 50, y, size: 9.5, font });
  y -= 24;

  y = drawSection(page, bold, "1. Purpose", y);
  y = drawParagraph(
    page,
    font,
    "The parties wish to explore a potential business relationship. In connection with that relationship, each party may disclose confidential and proprietary information to the other party.",
    50,
    y,
    512
  );
  y -= 8;

  y = drawSection(page, bold, "2. Confidential Information", y);
  y = drawParagraph(
    page,
    font,
    "Confidential Information means non-public information disclosed by one party to the other, whether orally, visually, in writing, or in any other tangible form, that is designated as confidential or would reasonably be understood to be confidential.",
    50,
    y,
    512
  );
  y -= 8;

  y = drawSection(page, bold, "3. Obligations", y);
  y = drawParagraph(
    page,
    font,
    "The receiving party shall use Confidential Information only for the purpose of evaluating the business relationship, shall protect it with reasonable care, and shall not disclose it to third parties without prior written consent.",
    50,
    y,
    512
  );
  y -= 8;

  y = drawSection(page, bold, "4. Term", y);
  y = drawParagraph(
    page,
    font,
    "The obligations of confidentiality shall remain in effect for three (3) years from the effective date, unless a longer period is required by applicable law.",
    50,
    y,
    512
  );
  y -= 8;

  y = drawSection(page, bold, "5. Payment", y);
  y = drawParagraph(
    page,
    font,
    "Client shall pay {{payment_amount}} as the fee associated with this Agreement. Payment terms shall be agreed by the parties in writing before any related work begins.",
    50,
    y,
    512
  );
  y -= 8;

  y = drawSection(page, bold, "6. Governing Law", y);
  y = drawParagraph(
    page,
    font,
    "This Agreement shall be governed by and construed in accordance with the laws of France, without regard to its conflict of laws principles.",
    50,
    y,
    512
  );
  y -= 20;

  page.drawText("IN WITNESS WHEREOF, the parties have executed this Agreement.", {
    x: 50,
    y,
    size: 9.5,
    font,
  });
  y -= 34;

  drawSignatureBlock(page, font, bold, 50, y, "AXA Assurance France", "Company Representative");
  drawSignatureBlock(page, font, bold, 310, y, "{{company_name}}", "Client Signer");

  page.drawText("Demo template generated by AXA Sign. Placeholders must be filled before sending.", {
    x: 50,
    y: 36,
    size: 7.5,
    font,
    color: rgb(0.4, 0.4, 0.5),
  });

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

function drawSection(page: PDFPage, font: PDFFont, title: string, y: number): number {
  page.drawText(title, {
    x: 50,
    y,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.18),
  });
  return y - 16;
}

function drawParagraph(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): number {
  const size = 9.5;
  const words = text.split(" ");
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y, size, font });
      y -= 12.5;
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    page.drawText(line, { x, y, size, font });
    y -= 12.5;
  }

  return y;
}

function drawSignatureBlock(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  partyName: string,
  roleName: string
) {
  page.drawText(partyName, { x, y, size: 10, font: bold });
  page.drawText(roleName, { x, y: y - 14, size: 8.5, font, color: rgb(0.4, 0.4, 0.5) });
  page.drawLine({ start: { x, y: y - 42 }, end: { x: x + 220, y: y - 42 } });
  page.drawText("Signature", { x, y: y - 54, size: 7.5, font, color: rgb(0.4, 0.4, 0.5) });
  page.drawText("Date: {{effective_date}}", { x, y: y - 70, size: 8.5, font });
}

function templateStorageKey(organizationId: string, version: number): string {
  return `${STORAGE_FOLDERS.TEMPLATES}/${organizationId}/nda-template-v${version}.pdf`;
}

async function upsertDocument(input: {
  id: string;
  name: string;
  storageKey: string;
  sha256: string;
  size: number;
  templateId: string;
  version: number;
}) {
  return prisma.document.upsert({
    where: { id: input.id },
    update: {
      name: input.name,
      mimeType: "application/pdf",
      size: input.size,
      sha256: input.sha256,
      storageKey: input.storageKey,
      metadata: {
        seeded: true,
        templateId: input.templateId,
        version: input.version,
      },
    },
    create: {
      id: input.id,
      name: input.name,
      mimeType: "application/pdf",
      size: input.size,
      sha256: input.sha256,
      storageKey: input.storageKey,
      metadata: {
        seeded: true,
        templateId: input.templateId,
        version: input.version,
      },
    },
  });
}

async function ensurePdfObject(storage: StorageClient, key: string, pdf: Buffer) {
  if (!(await storage.exists(key))) {
    await storage.upload(key, pdf, "application/pdf");
  }
}

async function upsertTemplateVersion(
  organizationId: string,
  templateId: string,
  storage: StorageClient
) {
  const pdf = await buildNdaPdf();
  const pdfSha = sha256(pdf);
  const latest = await prisma.templateVersion.findFirst({
    where: { templateId },
    orderBy: { version: "desc" },
  });

  if (!latest) {
    const version = 1;
    const storageKey = templateStorageKey(organizationId, version);
    const document = await upsertDocument({
      id: "seed_nda_document_v1",
      name: "nda-template-v1.pdf",
      storageKey,
      sha256: pdfSha,
      size: pdf.length,
      templateId,
      version,
    });
    await ensurePdfObject(storage, storageKey, pdf);
    const templateVersion = await prisma.templateVersion.create({
      data: {
        templateId,
        version,
        documentId: document.id,
        sha256: pdfSha,
      },
    });
    return { templateVersion, storageKey, pdf, pdfSha, changed: true };
  }

  if (latest.sha256 === pdfSha) {
    const storageKey = templateStorageKey(organizationId, latest.version);
    await upsertDocument({
      id: latest.documentId,
      name: `nda-template-v${latest.version}.pdf`,
      storageKey,
      sha256: pdfSha,
      size: pdf.length,
      templateId,
      version: latest.version,
    });
    await ensurePdfObject(storage, storageKey, pdf);
    return { templateVersion: latest, storageKey, pdf, pdfSha, changed: false };
  }

  const version = latest.version + 1;
  const storageKey = templateStorageKey(organizationId, version);
  const document = await upsertDocument({
    id: `seed_nda_document_v${version}`,
    name: `nda-template-v${version}.pdf`,
    storageKey,
    sha256: pdfSha,
    size: pdf.length,
    templateId,
    version,
  });
  await storage.upload(storageKey, pdf, "application/pdf");
  const templateVersion = await prisma.templateVersion.create({
    data: {
      templateId,
      version,
      documentId: document.id,
      sha256: pdfSha,
    },
  });
  return { templateVersion, storageKey, pdf, pdfSha, changed: true };
}

async function main() {
  assertSeedEnvironment();

  const adminPassword = readSeedPassword("SEED_ADMIN_PASSWORD");
  const agentPassword = readSeedPassword("SEED_AGENT_PASSWORD");

  const storage = createStorageClient();
  await storage.ensureBucket();

  const organization = await upsertOrganization();
  const admin = await upsertUser({
    email: ADMIN_EMAIL,
    password: adminPassword,
    firstName: "AXA",
    lastName: "Admin",
    role: "OWNER",
    organizationId: organization.id,
  });
  const agent = await upsertUser({
    email: AGENT_EMAIL,
    password: agentPassword,
    firstName: "AXA",
    lastName: "Agent",
    role: "MEMBER",
    organizationId: organization.id,
  });

  const template = await upsertTemplate(organization.id);
  const companyRole = await upsertRole(template.id, "Company Representative");
  const clientRole = await upsertRole(template.id, "Client Signer");
  const rolesByName = new Map([
    [companyRole.name, companyRole],
    [clientRole.name, clientRole],
  ]);

  for (const field of TEMPLATE_FIELDS) {
    const role = rolesByName.get(field.roleName);
    if (!role) throw new Error(`Missing template role: ${field.roleName}`);
    await upsertField({
      templateId: template.id,
      roleId: role.id,
      name: field.name,
      type: field.type,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    });
  }

  const result = await upsertTemplateVersion(organization.id, template.id, storage);

  console.log(`[seed] Organization: ${organization.name} (${organization.slug})`);
  console.log(`[seed] Admin: ${admin.email} (${admin.role})`);
  console.log(`[seed] Agent: ${agent.email} (${agent.role})`);
  console.log(`[seed] Template: ${template.name} (${template.category})`);
  console.log(
    `[seed] Template version: ${result.templateVersion.version}${result.changed ? " (created)" : " (unchanged)"}`
  );
  console.log(`[seed] PDF: ${result.storageKey} (${result.pdf.length} bytes)`);
  console.log(`[seed] PDF SHA-256: ${result.pdfSha}`);
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
