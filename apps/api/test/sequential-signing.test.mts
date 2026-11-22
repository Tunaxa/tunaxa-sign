import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const require = createRequire(resolve(repoRoot, "package.json"));
const prisma = require("@axa-sign/database").default;
const { hashToken, sha256 } = require("@axa-sign/shared");
const { createStorageClient, STORAGE_FOLDERS } = require("@axa-sign/storage");
const { PDFDocument, StandardFonts, PDFName } = require("pdf-lib");
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const queues = await import("@axa-sign/queue");
const { emailQueue, getRedisConnection } = queues;

const { DocumentService } = await import("../src/modules/documents/document.service.js");
const { ContractService } = await import("../src/modules/contracts/contract.service.js");
const { SigningService } = await import("../src/modules/signing/signing.service.js");
const { CertificateService } = await import("../src/modules/certificates/certificate.service.js");
const { registerEventHandlers } = await import("../src/events/register.js");

const pdfjs = await import(
  pathToFileURL(resolve(repoRoot, "node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve(repoRoot, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;

registerEventHandlers(new CertificateService());

const documents = new DocumentService();
const contracts = new ContractService();
const signing = new SigningService();
const storage = createStorageClient();
const s3 = new S3Client({
  endpoint: `http://${process.env.STORAGE_ENDPOINT || "localhost"}:${process.env.STORAGE_PORT || 9000}`,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  },
});
const bucket = process.env.STORAGE_BUCKET || "axa-sign";

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function solidPng(r, g, b) {
  const width = 200;
  const height = 64;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 4 + 1);
    for (let x = 0; x < width; x++) {
      raw[start + 1 + x * 4] = r;
      raw[start + 2 + x * 4] = g;
      raw[start + 3 + x * 4] = b;
      raw[start + 4 + x * 4] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
const RED = `data:image/png;base64,${solidPng(255, 0, 0).toString("base64")}`;
const BLUE = `data:image/png;base64,${solidPng(0, 0, 255).toString("base64")}`;
const GREEN = `data:image/png;base64,${solidPng(0, 180, 0).toString("base64")}`;

async function originalPdf(label) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText(`${label} sequential signing`, { x: 50, y: 740, size: 14, font });
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}
function makeFile(name, buffer) {
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype: "application/pdf",
    size: buffer.length,
    buffer,
    destination: "",
    filename: name,
    path: "",
  };
}
function matMul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function applyMatrix(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
async function renderImages(pdfBytes) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const ops = await page.getOperatorList();
  let ctm = viewport.transform.slice(0, 6);
  const stack = [];
  const boxes = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === pdfjs.OPS.transform) { ctm = matMul(ctm, args); continue; }
    if (fn === pdfjs.OPS.save) { stack.push(ctm.slice()); continue; }
    if (fn === pdfjs.OPS.restore) { ctm = stack.pop() ?? ctm; continue; }
    if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintInlineImageXObject) continue;
    const objId = fn === pdfjs.OPS.paintImageXObject ? args[0] : null;
    let img = objId ? await new Promise((r) => page.objs.get(objId, r)) : args[0];
    if (img && typeof img.then === "function") img = await img;
    if (!img?.data) continue;
    const bpp = img.data.length / (img.width * img.height);
    const corners = [applyMatrix(ctm, 0, 0), applyMatrix(ctm, 1, 0), applyMatrix(ctm, 0, 1), applyMatrix(ctm, 1, 1)];
    const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
    boxes.push({ box: [minX, minY, maxX, maxY], color: Array.from(img.data.slice(0, 3)) });
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const u = Math.min(img.width - 1, Math.max(0, Math.floor(((x - corners[0][0]) / (corners[1][0] - corners[0][0] || 1)) * img.width)));
        const v = Math.min(img.height - 1, Math.max(0, Math.floor(((y - corners[0][1]) / (corners[2][1] - corners[0][1] || 1)) * img.height)));
        const src = (v * img.width + u) * bpp;
        const dst = (y * width + x) * 4;
        rgba[dst] = img.data[src];
        rgba[dst + 1] = img.data[src + 1];
        rgba[dst + 2] = img.data[src + 2];
        rgba[dst + 3] = 255;
      }
    }
  }
  await pdf.destroy();
  return {
    boxes,
    sample: (x, y) => Array.from(rgba.slice((y * width + x) * 4, (y * width + x) * 4 + 4)),
  };
}
async function pdfStats(pdfBytes) {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  let imageCount = 0;
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    const subtype = obj.dict?.get?.(PDFName.of("Subtype"));
    if (subtype && String(subtype) === "/Image") imageCount++;
  }
  return { pages: pdf.getPageCount(), imageCount };
}
async function listKeys(prefix) {
  const result = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  return (result.Contents || []).map((object) => object.Key);
}
async function deleteKeys(keys) {
  const unique = [...new Set(keys.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 500) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: unique.slice(i, i + 500).map((Key) => ({ Key })) },
    }));
  }
}
async function allJobs() {
  return emailQueue.getJobs(
    ["waiting", "active", "completed", "delayed", "paused", "failed"],
    0,
    1000,
    true
  );
}
async function inviteJobsFor(fixture, names) {
  const emails = names.map((name) => fixture.participants[name].email);
  return (await allJobs()).filter(
    (job) => emails.includes(job.data?.to) && String(job.data?.html || "").includes("/session/")
  );
}
async function sessionTokenFor(fixture, name) {
  const participant = fixture.participants[name];
  const session = await prisma.signingSession.findFirst({
    where: {
      participantId: participant.id,
      completedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(session, `no active session for ${name}`);
  for (const job of await inviteJobsFor(fixture, [name])) {
    const match = String(job.data.html).match(/\/session\/([a-f0-9]{64})/);
    if (match && hashToken(match[1]) === session.tokenHash) return match[1];
  }
  throw new Error(`no invitation email token for ${name}`);
}
async function authenticate(fixture, name) {
  const token = await sessionTokenFor(fixture, name);
  await signing.authenticate(token);
  return token;
}
async function signAs(fixture, name, imageData = RED, x = 80, y = 100) {
  const token = await authenticate(fixture, name);
  return signing.sign(token, {
    token,
    type: "DRAWN",
    imageData,
    fieldX: x,
    fieldY: y,
    page: 1,
  });
}
async function sessionsFor(fixture, names) {
  return prisma.signingSession.findMany({
    where: { participantId: { in: names.map((name) => fixture.participants[name].id) } },
  });
}
async function versionsFor(contractId) {
  return prisma.contractVersion.findMany({
    where: { contractId },
    orderBy: { version: "asc" },
    include: { document: true },
  });
}
async function evidenceFor(contractId) {
  const evidence = await prisma.signatureEvidence.findMany({
    where: { signature: { contractId } },
    orderBy: { signature: { createdAt: "asc" } },
    include: { signature: true },
  });
  return evidence.map((item) => ({
    before: item.documentHashBefore,
    after: item.documentHashAfter,
    x: item.signature.fieldX,
  }));
}

interface Cleanup {
  orgIds: string[];
  contractIds: string[];
  storageKeys: string[];
}
interface Fixture {
  org: any;
  user: any;
  contract: any;
  participants: Record<string, any>;
  pdf: Buffer;
  upload: any;
}

async function createFixture(
  ctx: Cleanup,
  label: string,
  definitions: Array<{ name: string; type: string; signingOrder: number }>,
  send = true
): Promise<Fixture> {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const org = await prisma.organization.create({
    data: { name: `${label} ${suffix}`, slug: `${label.toLowerCase()}-${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `${label.toLowerCase()}-${suffix}@example.test`,
      passwordHash: "not-used",
      firstName: "Sequential",
      lastName: "Tester",
      organizationId: org.id,
    },
  });
  ctx.orgIds.push(org.id);
  const contract = await prisma.contract.create({
    data: { title: `${label} ${suffix}`, organizationId: org.id, createdBy: user.id },
  });
  ctx.contractIds.push(contract.id);
  const pdf = await originalPdf(label);
  const upload: any = await documents.upload(
    org.id,
    user.id,
    makeFile(`${label}-original.pdf`, pdf),
    contract.id
  );
  ctx.storageKeys.push(upload.storageKey);

  const participants: Record<string, any> = {};
  for (const definition of definitions) {
    participants[definition.name] = await prisma.participant.create({
      data: {
        contractId: contract.id,
        name: definition.name,
        email: `${label.toLowerCase()}-${definition.name.toLowerCase()}-${suffix}@example.test`,
        type: definition.type,
        signingOrder: definition.signingOrder,
      },
    });
  }

  if (send) {
    await contracts.send(org.id, contract.id, user.id);
  }

  return { org, user, contract, participants, pdf, upload };
}

test("TUN2-10: sequential signing invitations and completion", async (t) => {
  const ctx: Cleanup = { orgIds: [], contractIds: [], storageKeys: [] };
  await storage.ensureBucket();

  try {
    await t.test("orders 1, 2, 3 invite one group at a time and complete once", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 three", [
        { name: "First", type: "SIGNER", signingOrder: 1 },
        { name: "Second", type: "SIGNER", signingOrder: 2 },
        { name: "Third", type: "SIGNER", signingOrder: 3 },
      ]);

      assert.equal((await sessionsFor(fixture, ["First", "Second", "Third"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["First", "Second", "Third"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["First"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["Second", "Third"])).length, 0);

      await signAs(fixture, "First", RED, 80, 100);
      assert.equal((await sessionsFor(fixture, ["First", "Second", "Third"])).length, 2);
      assert.equal((await inviteJobsFor(fixture, ["Second"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["Third"])).length, 0);

      await signAs(fixture, "Second", BLUE, 320, 100);
      assert.equal((await sessionsFor(fixture, ["First", "Second", "Third"])).length, 3);
      assert.equal((await inviteJobsFor(fixture, ["Third"])).length, 1);

      await signAs(fixture, "Third", GREEN, 80, 300);
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "COMPLETED");
      const versions = await versionsFor(fixture.contract.id);
      assert.deepEqual(versions.map((v) => v.version), [1, 2, 3, 4]);
      assert.deepEqual(versions.map((v) => v.isCurrent), [false, false, false, true]);
      assert.equal(contract.currentVersionId, versions[3].id);
      assert.equal(await prisma.certificate.count({ where: { contractId: fixture.contract.id } }), 1);

      const evidence = await evidenceFor(fixture.contract.id);
      assert.equal(evidence.length, 3);
      assert.equal(evidence[0].before, sha256(fixture.pdf));
      assert.equal(evidence[1].before, evidence[0].after);
      assert.equal(evidence[2].before, evidence[1].after);
      assert.equal(evidence[0].after, versions[1].sha256);
      assert.equal(evidence[1].after, versions[2].sha256);
      assert.equal(evidence[2].after, versions[3].sha256);

      const finalPdf = await storage.download(versions[3].document.storageKey);
      assert.deepEqual(await pdfStats(finalPdf), { pages: 1, imageCount: 3 });
      const rendered = await renderImages(finalPdf);
      assert.equal(rendered.boxes.length, 3);
      assert.deepEqual(rendered.sample(100, 120).slice(0, 3), [255, 0, 0]);
      assert.deepEqual(rendered.sample(340, 120).slice(0, 3), [0, 0, 255]);
      assert.deepEqual(rendered.sample(100, 320).slice(0, 3), [0, 180, 0]);
    });

    await t.test("same order [1, 1, 2] invites together and waits for both", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 parallel", [
        { name: "A", type: "SIGNER", signingOrder: 1 },
        { name: "B", type: "SIGNER", signingOrder: 1 },
        { name: "C", type: "SIGNER", signingOrder: 2 },
      ]);

      assert.equal((await sessionsFor(fixture, ["A", "B", "C"])).length, 2);
      assert.equal((await inviteJobsFor(fixture, ["A", "B"])).length, 2);
      assert.equal((await inviteJobsFor(fixture, ["C"])).length, 0);

      await signAs(fixture, "A", RED, 80, 100);
      assert.equal((await sessionsFor(fixture, ["C"])).length, 0);
      assert.equal((await inviteJobsFor(fixture, ["C"])).length, 0);

      await signAs(fixture, "B", BLUE, 320, 100);
      assert.equal((await sessionsFor(fixture, ["C"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["C"])).length, 1);

      await signAs(fixture, "C", GREEN, 80, 300);
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "COMPLETED");
      assert.equal(await prisma.certificate.count({ where: { contractId: fixture.contract.id } }), 1);
    });

    await t.test("five parallel last-but-one groups invite the next group exactly once", async () => {
      for (let run = 0; run < 5; run++) {
        const fixture = await createFixture(ctx, `TUN2-10 race${run}`, [
          { name: "A", type: "SIGNER", signingOrder: 1 },
          { name: "B", type: "SIGNER", signingOrder: 1 },
          { name: "C", type: "SIGNER", signingOrder: 2 },
        ]);
        const tokenA = await authenticate(fixture, "A");
        const tokenB = await authenticate(fixture, "B");
        await Promise.all([
          signing.sign(tokenA, { token: tokenA, type: "DRAWN", imageData: RED, fieldX: 80, fieldY: 100, page: 1 }),
          signing.sign(tokenB, { token: tokenB, type: "DRAWN", imageData: BLUE, fieldX: 320, fieldY: 100, page: 1 }),
        ]);
        assert.equal((await sessionsFor(fixture, ["C"])).length, 1, `run ${run}: duplicate session`);
        assert.equal((await inviteJobsFor(fixture, ["C"])).length, 1, `run ${run}: duplicate email`);
        const audit = await prisma.auditEvent.count({
          where: { contractId: fixture.contract.id, type: "participant.invited" },
        });
        assert.equal(audit, 1, `run ${run}: duplicate audit`);
      }
    });

    await t.test("parallel final group completes exactly once", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 final race", [
        { name: "A", type: "SIGNER", signingOrder: 1 },
        { name: "B", type: "SIGNER", signingOrder: 2 },
        { name: "C", type: "SIGNER", signingOrder: 2 },
      ]);
      await signAs(fixture, "A", RED, 80, 100);
      const tokenB = await authenticate(fixture, "B");
      const tokenC = await authenticate(fixture, "C");
      await Promise.all([
        signing.sign(tokenB, { token: tokenB, type: "DRAWN", imageData: BLUE, fieldX: 320, fieldY: 100, page: 1 }),
        signing.sign(tokenC, { token: tokenC, type: "DRAWN", imageData: GREEN, fieldX: 80, fieldY: 300, page: 1 }),
      ]);
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "COMPLETED");
      assert.equal(await prisma.certificate.count({ where: { contractId: fixture.contract.id } }), 1);
      const certObjects = await listKeys(`certificates/${fixture.org.id}/${fixture.contract.id}/`);
      assert.equal(certObjects.length, 1);
    });

    await t.test("gaps, zero starts and all-equal orders", async () => {
      for (const [firstOrder, secondOrder] of [[0, 5], [1, 10]]) {
        const fixture = await createFixture(ctx, `TUN2-10 gaps${firstOrder}`, [
          { name: "A", type: "SIGNER", signingOrder: firstOrder },
          { name: "B", type: "SIGNER", signingOrder: secondOrder },
        ]);
        assert.equal((await sessionsFor(fixture, ["A"])).length, 1);
        assert.equal((await sessionsFor(fixture, ["B"])).length, 0);
        assert.equal((await inviteJobsFor(fixture, ["B"])).length, 0);
        await signAs(fixture, "A", RED, 80, 100);
        assert.equal((await sessionsFor(fixture, ["B"])).length, 1);
        assert.equal((await inviteJobsFor(fixture, ["B"])).length, 1);
        await signAs(fixture, "B", BLUE, 320, 100);
        const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
        assert.equal(contract.status, "COMPLETED");
      }

      const fixture = await createFixture(ctx, "TUN2-10 all zero", [
        { name: "A", type: "SIGNER", signingOrder: 0 },
        { name: "B", type: "SIGNER", signingOrder: 0 },
        { name: "C", type: "SIGNER", signingOrder: 0 },
      ]);
      assert.equal((await sessionsFor(fixture, ["A", "B", "C"])).length, 3);
      assert.equal((await inviteJobsFor(fixture, ["A", "B", "C"])).length, 3);
    });

    await t.test("VIEWER and CC never receive a session or an invitation", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 viewer", [
        { name: "First", type: "SIGNER", signingOrder: 1 },
        { name: "Viewer", type: "VIEWER", signingOrder: 2 },
        { name: "Copy", type: "CC", signingOrder: 3 },
        { name: "Second", type: "SIGNER", signingOrder: 4 },
      ]);
      assert.equal((await sessionsFor(fixture, ["Viewer", "Copy"])).length, 0);
      assert.equal((await inviteJobsFor(fixture, ["Viewer", "Copy"])).length, 0);

      await signAs(fixture, "First", RED, 80, 100);
      assert.equal((await sessionsFor(fixture, ["Viewer", "Copy"])).length, 0);
      assert.equal((await inviteJobsFor(fixture, ["Viewer", "Copy"])).length, 0);
      assert.equal((await sessionsFor(fixture, ["Second"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["Second"])).length, 1);

      await signAs(fixture, "Second", BLUE, 320, 100);
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "COMPLETED");
    });

    await t.test("APPROVER order 1 is sequenced before SIGNER order 2", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 approver", [
        { name: "Approver", type: "APPROVER", signingOrder: 1 },
        { name: "Signer", type: "SIGNER", signingOrder: 2 },
      ]);
      const steps = await prisma.signingStep.findMany({
        where: { contractId: fixture.contract.id },
        orderBy: { step: "asc" },
      });
      assert.deepEqual(steps.map((step) => step.type), ["APPROVE", "SIGN"]);
      assert.equal((await sessionsFor(fixture, ["Approver"])).length, 1);
      assert.equal((await sessionsFor(fixture, ["Signer"])).length, 0);
      assert.equal((await inviteJobsFor(fixture, ["Signer"])).length, 0);

      await signAs(fixture, "Approver", RED, 80, 100);
      assert.equal((await sessionsFor(fixture, ["Signer"])).length, 1);
      assert.equal((await inviteJobsFor(fixture, ["Signer"])).length, 1);
      await signAs(fixture, "Signer", BLUE, 320, 100);
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "COMPLETED");
    });

    await t.test("manual session for a later participant cannot sign early", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 turn", [
        { name: "First", type: "SIGNER", signingOrder: 1 },
        { name: "Second", type: "SIGNER", signingOrder: 2 },
      ]);
      const manual = await signing.createSession(fixture.contract.id, fixture.participants.Second.id);
      await signing.authenticate(manual.token);
      await assert.rejects(
        signing.sign(manual.token, {
          token: manual.token,
          type: "DRAWN",
          imageData: BLUE,
          fieldX: 320,
          fieldY: 100,
          page: 1,
        }),
        (error: any) => error.statusCode === 409 && /not your turn/i.test(error.message)
      );
      assert.equal((await sessionsFor(fixture, ["Second"])).length, 1);
      assert.equal((await prisma.signature.count({ where: { contractId: fixture.contract.id } })), 0);

      await signAs(fixture, "First", RED, 80, 100);
      assert.equal((await sessionsFor(fixture, ["Second"])).length, 1);
      await signing.sign(manual.token, {
        token: manual.token,
        type: "DRAWN",
        imageData: BLUE,
        fieldX: 320,
        fieldY: 100,
        page: 1,
      });
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "COMPLETED");
    });

    await t.test("pre-commit failure rolls back signature and next-group session", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 atomic", [
        { name: "First", type: "SIGNER", signingOrder: 1 },
        { name: "Second", type: "SIGNER", signingOrder: 2 },
      ]);
      const originalTransaction = prisma.$transaction;
      (prisma as any).$transaction = async (arg: any, options?: any) => {
        if (typeof arg !== "function") return originalTransaction.call(prisma, arg, options);
        return originalTransaction.call(prisma, async (tx: any) => {
          await arg(tx);
          throw new Error("FORCED_PRE_COMMIT_FAILURE");
        }, options);
      };
      try {
        await assert.rejects(
          signAs(fixture, "First", RED, 80, 100),
          /FORCED_PRE_COMMIT_FAILURE/
        );
      } finally {
        (prisma as any).$transaction = originalTransaction;
      }
      assert.equal((await prisma.signature.count({ where: { contractId: fixture.contract.id } })), 0);
      assert.equal((await sessionsFor(fixture, ["Second"])).length, 0);
      assert.equal((await inviteJobsFor(fixture, ["Second"])).length, 0);
      assert.equal(
        (await prisma.participant.findUniqueOrThrow({ where: { id: fixture.participants.First.id } })).status,
        "PENDING"
      );
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.status, "SENT");
      assert.deepEqual(await listKeys(`signed/${fixture.org.id}/${fixture.contract.id}/`), []);
    });

    await t.test("cross-organization send cannot affect another org", async () => {
      const fixture = await createFixture(ctx, "TUN2-10 org", [
        { name: "First", type: "SIGNER", signingOrder: 1 },
      ], false);
      const other = await createFixture(ctx, "TUN2-10 other", [
        { name: "Other", type: "SIGNER", signingOrder: 1 },
      ], false);

      await assert.rejects(
        contracts.send(other.org.id, fixture.contract.id, other.user.id),
        (error: any) => error.statusCode === 404
      );
      assert.equal((await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } })).status, "DRAFT");
      assert.equal((await sessionsFor(fixture, ["First"])).length, 0);

      await contracts.send(fixture.org.id, fixture.contract.id, fixture.user.id);
      assert.equal((await sessionsFor(fixture, ["First"])).length, 1);
      assert.equal((await prisma.contract.findUniqueOrThrow({ where: { id: other.contract.id } })).status, "DRAFT");
      assert.equal((await sessionsFor(other, ["Other"])).length, 0);
      assert.equal((await prisma.signingStep.count({ where: { contractId: other.contract.id } })), 0);
    });
  } finally {
    try {
      const jobs = await allJobs();
      const notificationIds = new Set(
        (
          await prisma.notification.findMany({
            where: { organizationId: { in: ctx.orgIds } },
            include: { deliveries: true },
          })
        ).flatMap((notification) => notification.deliveries.map((delivery) => delivery.id))
      );
      for (const job of jobs as any[]) {
        if (notificationIds.has(job.data?.notificationId)) {
          await job.remove().catch(() => undefined);
        }
      }
    } catch {}

    try {
      for (const orgId of ctx.orgIds) {
        ctx.storageKeys.push(...(await listKeys(`signed/${orgId}/`)));
        ctx.storageKeys.push(...(await listKeys(`certificates/${orgId}/`)));
      }
      await deleteKeys(ctx.storageKeys);
    } catch {}

    try {
      await prisma.contract.updateMany({
        where: { id: { in: ctx.contractIds } },
        data: { currentVersionId: null },
      });
      await prisma.signingSession.deleteMany({
        where: { participant: { contract: { organizationId: { in: ctx.orgIds } } } },
      });
      await prisma.signatureEvidence.deleteMany({
        where: { signature: { contract: { organizationId: { in: ctx.orgIds } } } },
      });
      await prisma.signature.deleteMany({
        where: { contract: { organizationId: { in: ctx.orgIds } } },
      });
      await prisma.signingStep.deleteMany({
        where: { contract: { organizationId: { in: ctx.orgIds } } },
      });
      await prisma.notification.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.participant.deleteMany({
        where: { contract: { organizationId: { in: ctx.orgIds } } },
      });
      await prisma.certificate.deleteMany({
        where: { contract: { organizationId: { in: ctx.orgIds } } },
      });
      await prisma.contractVersion.deleteMany({
        where: { contract: { organizationId: { in: ctx.orgIds } } },
      });
      await prisma.contract.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.document.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: ctx.orgIds } } });
    } catch {}

    s3.destroy();
    await emailQueue.close().catch(() => undefined);
    await prisma.$disconnect();
    const redis = getRedisConnection();
    await redis.quit().catch(() => redis.disconnect());
  }
});
