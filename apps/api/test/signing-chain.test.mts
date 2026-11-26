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
const { default: prisma } = await import("@axa-sign/database");
const { sha256 } = await import("@axa-sign/crypto");
const { createStorageClient, STORAGE_FOLDERS } = await import("@axa-sign/storage");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const { DocumentService } = await import("../src/modules/documents/document.service.js");
const { ContractService } = await import("../src/modules/contracts/contract.service.js");
const { SigningService } = await import("../src/modules/signing/signing.service.js");
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
const queues = await import("@axa-sign/queue");
const { getRedisConnection } = queues;

const pdfjs = await import(
  pathToFileURL(resolve(repoRoot, "node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve(repoRoot, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;

const documents = new DocumentService();
const contracts = new ContractService();
const signing = new SigningService();
const storage = createStorageClient();
const s3 = new S3Client({
  endpoint: `http://${process.env.STORAGE_ENDPOINT}:${process.env.STORAGE_PORT}`,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.STORAGE_SECRET_KEY,
  },
});
const bucket = process.env.STORAGE_BUCKET;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function solidPng(r: number, g: number, b: number) {
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

async function originalPdf(label: string, pages = 2) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`${label} page ${i + 1}`, { x: 50, y: 740, size: 14, font });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}
function makeFile(name: string, buffer: Buffer): Express.Multer.File {
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
  } as unknown as Express.Multer.File;
}
function matMul(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function applyMatrix(m: number[], x: number, y: number) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
async function renderImages(pdfBytes: Buffer) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const ops = await page.getOperatorList();
  let ctm = viewport.transform.slice(0, 6);
  const stack: number[][] = [];
  const boxes: Array<{ box: number[]; color: number[] }> = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === pdfjs.OPS.transform) { ctm = matMul(ctm, args); continue; }
    if (fn === pdfjs.OPS.save) { stack.push(ctm.slice()); continue; }
    if (fn === pdfjs.OPS.restore) { ctm = stack.pop() ?? ctm; continue; }
    if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintInlineImageXObject) continue;
    const objId = fn === pdfjs.OPS.paintImageXObject ? args[0] : null;
    let img: any = objId ? await new Promise((r) => page.objs.get(objId, r)) : args[0];
    if (img && typeof img.then === "function") img = await img;
    if (!img?.data) continue;
    const bpp = img.data.length / (img.width * img.height);
    const corners = [applyMatrix(ctm, 0, 0), applyMatrix(ctm, 1, 0), applyMatrix(ctm, 0, 1), applyMatrix(ctm, 1, 1)];
    const minX = Math.max(0, Math.floor(Math.min(...corners.map((c: number[]) => c[0]))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...corners.map((c: number[]) => c[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...corners.map((c: number[]) => c[1]))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...corners.map((c: number[]) => c[1]))));
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
  const sample = (x: number, y: number) => Array.from(rgba.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
  return { boxes, sample, width, height };
}
async function pdfStats(pdfBytes: Buffer) {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const { PDFName } = require("pdf-lib");
  let imageCount = 0;
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    const subtype = obj.dict?.get?.(PDFName.of("Subtype"));
    if (subtype && String(subtype) === "/Image") imageCount++;
  }
  return { pages: pdf.getPageCount(), imageCount };
}
async function listSignedKeys(orgId: string, contractId: string) {
  const result = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${STORAGE_FOLDERS.SIGNED}/${orgId}/${contractId}/`,
  }));
  return (result.Contents || []).map((o: any) => o.Key as string);
}
async function deleteKeys(keys: string[]) {
  if (keys.length === 0) return;
  await s3.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: keys.map((Key) => ({ Key })) },
  }));
}
async function versions(contractId: string) {
  return prisma.contractVersion.findMany({
    where: { contractId },
    orderBy: { version: "asc" },
    include: { document: true },
  });
}
interface Fixture {
  org: any;
  user: any;
  contract: any;
  upload: any;
  pdf: Buffer;
  signedKeys: string[];
}
interface Cleanup {
  orgIds: string[];
  storageKeys: string[];
}
async function createFixture(ctx: Cleanup, label: string, options: { valid?: boolean; pages?: number } = {}): Promise<Fixture> {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const org = await prisma.organization.create({
    data: { name: `${label} ${suffix}`, slug: `${label.toLowerCase()}-${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `${label.toLowerCase()}-${suffix}@example.test`,
      passwordHash: "not-used",
      firstName: "TUN2",
      lastName: "Eight",
      organizationId: org.id,
    },
  });
  ctx.orgIds.push(org.id);
  const contract = await prisma.contract.create({
    data: { title: `${label} ${suffix}`, organizationId: org.id, createdBy: user.id },
  });
  const pdf = options.valid === false ? Buffer.from("%PDF-1.4\n1 0 obj\n<< /Corrupt") : await originalPdf(label, options.pages ?? 2);
  const upload: any = await documents.upload(
    org.id,
    user.id,
    makeFile(`${label}-original.pdf`, pdf),
    contract.id
  );
  ctx.storageKeys.push(upload.storageKey);
  await prisma.contract.update({ where: { id: contract.id }, data: { status: "SENT" } });
  return { org, user, contract, upload, pdf, signedKeys: [] };
}
async function addSigner(contract: any, label: string, imageData: string, x: number, y: number) {
  const participant = await prisma.participant.create({
    data: {
      contractId: contract.id,
      name: label,
      email: `${label.toLowerCase()}-${contract.id}@example.test`,
      type: "SIGNER",
      signingOrder: 0,
    },
  });
  const session = await signing.createSession(contract.id, participant.id);
  await signing.authenticate(session.token);
  return { participant, token: session.token, imageData, x, y };
}
function signPayload(signer: Awaited<ReturnType<typeof addSigner>>) {
  return {
    token: signer.token,
    type: "DRAWN",
    imageData: signer.imageData,
    fieldX: signer.x,
    fieldY: signer.y,
    page: 1,
  };
}
async function evidenceChain(contractId: string) {
  const evidence = await prisma.signatureEvidence.findMany({
    where: { signature: { contractId } },
    orderBy: { signature: { createdAt: "asc" } },
    include: { signature: true },
  });
  return evidence.map((e) => ({
    before: e.documentHashBefore,
    after: e.documentHashAfter,
    x: e.signature.fieldX,
    y: e.signature.fieldY,
  }));
}

test("TUN2-8: chained signatures, concurrency, atomicity and errors", async (t) => {
  const ctx: Cleanup = { orgIds: [], storageKeys: [] };
  try {
    await storage.ensureBucket();

    await t.test("two sequential signers chain v1 -> v2 -> v3 with both colors", async () => {
      const fixture = await createFixture(ctx, "TUN2-8 seq");
      const one = await addSigner(fixture.contract, "Red", RED, 80, 100);
      const two = await addSigner(fixture.contract, "Blue", BLUE, 320, 100);

      await signing.sign(one.token, signPayload(one));
      const afterFirst = await versions(fixture.contract.id);
      assert.deepEqual(afterFirst.map((v) => v.version), [1, 2]);
      assert.deepEqual(afterFirst.map((v) => v.isCurrent), [false, true]);

      await signing.sign(two.token, signPayload(two));
      const chain = await versions(fixture.contract.id);
      assert.deepEqual(chain.map((v) => v.version), [1, 2, 3]);
      assert.equal(chain.filter((v) => v.isCurrent).length, 1);
      assert.equal(chain[2].isCurrent, true);
      const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(contract.currentVersionId, chain[2].id);
      assert.equal(contract.status, "COMPLETED");

      for (const v of chain) {
        assert.equal(v.document.organizationId, fixture.org.id);
        ctx.storageKeys.push(v.document.storageKey);
        const cert = await prisma.certificate.findFirst({ where: { contractId: fixture.contract.id } });
        if (cert) ctx.storageKeys.push(cert.pdfKey);
      }

      const evidence = await evidenceChain(fixture.contract.id);
      assert.equal(evidence.length, 2);
      assert.equal(evidence[0].before, sha256(fixture.pdf));
      assert.equal(evidence[0].after, chain[1].sha256);
      assert.equal(evidence[1].before, chain[1].sha256);
      assert.equal(evidence[1].after, chain[2].sha256);

      const finalPdf = await storage.download(chain[2].document.storageKey);
      const stats = await pdfStats(finalPdf);
      assert.deepEqual(stats, { pages: 2, imageCount: 2 });
      assert.deepEqual(await pdfStats(fixture.pdf), { pages: 2, imageCount: 0 });
      const rendered = await renderImages(finalPdf);
      assert.equal(rendered.boxes.length, 2);
      assert.deepEqual(rendered.sample(100, 120).slice(0, 3), [255, 0, 0]);
      assert.deepEqual(rendered.sample(340, 120).slice(0, 3), [0, 0, 255]);

      const signedKeys = await listSignedKeys(fixture.org.id, fixture.contract.id);
      assert.equal(signedKeys.length, 2);
      ctx.storageKeys.push(...signedKeys);
      fixture.signedKeys = signedKeys;
    });

    await t.test("double sign returns 409 and changes nothing", async () => {
      const fixture = await createFixture(ctx, "TUN2-8 dup");
      const signer = await addSigner(fixture.contract, "Dup", RED, 80, 100);
      await signing.sign(signer.token, signPayload(signer));
      const before = await versions(fixture.contract.id);
      await assert.rejects(
        signing.sign(signer.token, signPayload(signer)),
        (error: any) => error.statusCode === 409 && /already signed/i.test(error.message)
      );
      assert.deepEqual((await versions(fixture.contract.id)).map((v) => v.version), before.map((v) => v.version));
      ctx.storageKeys.push(...before.map((v) => v.document.storageKey));
      ctx.storageKeys.push(...(await listSignedKeys(fixture.org.id, fixture.contract.id)));
      const cert = await prisma.certificate.findFirst({ where: { contractId: fixture.contract.id } });
      if (cert) ctx.storageKeys.push(cert.pdfKey);
    });

    await t.test("fieldY is used instead of fieldX", async () => {
      const fixture = await createFixture(ctx, "TUN2-8 y", { pages: 1 });
      const signer = await addSigner(fixture.contract, "Y", BLUE, 80, 260);
      await signing.sign(signer.token, signPayload(signer));
      const chain = await versions(fixture.contract.id);
      const rendered = await renderImages(await storage.download(chain[1].document.storageKey));
      assert.equal(rendered.boxes.length, 1);
      assert.ok(rendered.boxes[0].box[0] >= 78 && rendered.boxes[0].box[0] <= 82, `x box ${rendered.boxes[0].box}`);
      assert.ok(rendered.boxes[0].box[1] >= 258 && rendered.boxes[0].box[1] <= 262, `y box ${rendered.boxes[0].box}`);
      assert.deepEqual(rendered.sample(100, 280).slice(0, 3), [0, 0, 255]);
      ctx.storageKeys.push(...chain.map((v) => v.document.storageKey));
      ctx.storageKeys.push(...(await listSignedKeys(fixture.org.id, fixture.contract.id)));
      const cert = await prisma.certificate.findFirst({ where: { contractId: fixture.contract.id } });
      if (cert) ctx.storageKeys.push(cert.pdfKey);
    });

    await t.test("five parallel signer pairs always produce versions 2 and 3", async () => {
      for (let run = 0; run < 5; run++) {
        const fixture = await createFixture(ctx, `TUN2-8 par${run}`);
        const one = await addSigner(fixture.contract, "ParallelRed", RED, 80, 100);
        const two = await addSigner(fixture.contract, "ParallelBlue", BLUE, 320, 100);
        await Promise.all([
          signing.sign(one.token, signPayload(one)),
          signing.sign(two.token, signPayload(two)),
        ]);
        const chain = await versions(fixture.contract.id);
        assert.deepEqual(chain.map((v) => v.version), [1, 2, 3]);
        assert.equal(chain.filter((v) => v.isCurrent).length, 1);
        const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
        assert.equal(contract.currentVersionId, chain[2].id);
        assert.equal(await prisma.signature.count({ where: { contractId: fixture.contract.id } }), 2);
        const finalPdf = await storage.download(chain[2].document.storageKey);
        const stats = await pdfStats(finalPdf);
        assert.deepEqual(stats, { pages: 2, imageCount: 2 });
        const rendered = await renderImages(finalPdf);
        assert.deepEqual(rendered.sample(100, 120).slice(0, 3), [255, 0, 0]);
        assert.deepEqual(rendered.sample(340, 120).slice(0, 3), [0, 0, 255]);
        const signedKeys = await listSignedKeys(fixture.org.id, fixture.contract.id);
        assert.equal(signedKeys.length, 2, `run ${run} orphan objects: ${signedKeys.join(",")}`);
        ctx.storageKeys.push(...signedKeys, ...chain.map((v) => v.document.storageKey));
        const cert = await prisma.certificate.findFirst({ where: { contractId: fixture.contract.id } });
        if (cert) ctx.storageKeys.push(cert.pdfKey);
      }
    });

    await t.test("failure after upload rolls back every write and removes the object", async () => {
      const fixture = await createFixture(ctx, "TUN2-8 atomic");
      const signer = await addSigner(fixture.contract, "Atomic", RED, 80, 100);
      const beforeVersions = await versions(fixture.contract.id);
      const beforeContract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
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
          signing.sign(signer.token, signPayload(signer)),
          /FORCED_PRE_COMMIT_FAILURE/
        );
      } finally {
        (prisma as any).$transaction = originalTransaction;
      }

      assert.deepEqual((await versions(fixture.contract.id)).map((v) => v.version), beforeVersions.map((v) => v.version));
      const afterContract = await prisma.contract.findUniqueOrThrow({ where: { id: fixture.contract.id } });
      assert.equal(afterContract.currentVersionId, beforeContract.currentVersionId);
      assert.equal((await prisma.participant.findUniqueOrThrow({ where: { id: signer.participant.id } })).status, "PENDING");
      assert.equal(await prisma.document.count({ where: { organizationId: fixture.org.id } }), 1);
      assert.equal(await prisma.signature.count({ where: { contractId: fixture.contract.id } }), 0);
      assert.equal(await prisma.signatureEvidence.count({ where: { signature: { contractId: fixture.contract.id } } }), 0);
      assert.deepEqual(await listSignedKeys(fixture.org.id, fixture.contract.id), []);
      ctx.storageKeys.push(...beforeVersions.map((v) => v.document.storageKey));
    });

    await t.test("unreadable PDF fails with 422 and leaves participant unsigned", async () => {
      const fixture = await createFixture(ctx, "TUN2-8 badpdf", { valid: false });
      const signer = await addSigner(fixture.contract, "BadPdf", RED, 80, 100);
      await assert.rejects(
        signing.sign(signer.token, signPayload(signer)),
        (error: any) => error.statusCode === 422 && error.code === "UNREADABLE_PDF"
      );
      assert.equal((await prisma.participant.findUniqueOrThrow({ where: { id: signer.participant.id } })).status, "PENDING");
      assert.equal(await prisma.document.count({ where: { organizationId: fixture.org.id } }), 1);
      assert.equal((await versions(fixture.contract.id)).length, 1);
      assert.deepEqual(await listSignedKeys(fixture.org.id, fixture.contract.id), []);
      ctx.storageKeys.push(...(await versions(fixture.contract.id)).map((v) => v.document.storageKey));
    });

    await t.test("cross-organization contract and document access is rejected", async () => {
      const fixture = await createFixture(ctx, "TUN2-8 crossorg");
      const other = await prisma.organization.create({
        data: { name: `TUN2-8 other ${Date.now()}`, slug: `tun2-8-other-${Date.now()}` },
      });
      ctx.orgIds.push(other.id);
      await assert.rejects(
        documents.getById(other.id, fixture.upload.id),
        (error: any) => error.statusCode === 404
      );
      await assert.rejects(
        contracts.getById(other.id, fixture.contract.id),
        (error: any) => error.statusCode === 404
      );
      ctx.storageKeys.push(fixture.upload.storageKey);
    });
  } finally {
    try {
      await prisma.signingSession.deleteMany({ where: { participant: { contract: { organizationId: { in: ctx.orgIds } } } } });
      await prisma.signatureEvidence.deleteMany({ where: { signature: { contract: { organizationId: { in: ctx.orgIds } } } } });
      await prisma.signature.deleteMany({ where: { contract: { organizationId: { in: ctx.orgIds } } } });
      await prisma.signingStep.deleteMany({ where: { contract: { organizationId: { in: ctx.orgIds } } } });
      await prisma.notification.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.participant.deleteMany({ where: { contract: { organizationId: { in: ctx.orgIds } } } });
      await prisma.certificate.deleteMany({ where: { contract: { organizationId: { in: ctx.orgIds } } } });
      await prisma.contractVersion.deleteMany({ where: { contract: { organizationId: { in: ctx.orgIds } } } });
      await prisma.contract.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.document.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: ctx.orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: ctx.orgIds } } });
    } catch {}
    await deleteKeys([...new Set(ctx.storageKeys)]);
    s3.destroy();
    for (const q of Object.values(queues)) {
      if (q && typeof (q as any).close === "function") {
        await (q as any).close();
      }
    }
    await prisma.$disconnect();
    const redis = getRedisConnection();
    await redis.quit().catch(() => redis.disconnect());
  }
});
