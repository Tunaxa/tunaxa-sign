import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { prisma } from "@axa-sign/database";
import { MAX_FILE_SIZE, AppError } from "@axa-sign/shared";
import { StorageClient } from "@axa-sign/storage";
import { eventBus } from "@axa-sign/events";
import { errorHandler } from "../src/middleware/error.js";
import { documentRoutes } from "../src/modules/documents/document.routes.js";
import { DocumentService } from "../src/modules/documents/document.service.js";

function makeFile(
  name: string,
  mimetype: string,
  buffer: Buffer
): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype,
    size: buffer.length,
    buffer,
    destination: "",
    filename: name,
    path: "",
  } as unknown as Express.Multer.File;
}

function createTestApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = {
      sub: "user-test-1",
      email: "test@example.com",
      organizationId: "org-test-1",
      role: "ADMIN",
    } as any;
    next();
  });
  app.use("/documents", documentRoutes);
  app.use(errorHandler);
  return app;
}

async function postFile(
  baseUrl: string,
  filename: string,
  mimetype: string,
  content: Buffer
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(content)], { type: mimetype }),
    filename
  );
  return fetch(`${baseUrl}/documents`, {
    method: "POST",
    body: form,
  });
}

test("AXS-011: PDF upload validation", async (t) => {
  await t.test("accepts a valid PDF", async (t) => {
    const service = new DocumentService();
    const uploadMock = t.mock.method(
      StorageClient.prototype,
      "upload",
      async () => "original/org-1/valid.pdf"
    );
    const originalCreate = prisma.document.create;
    const createMock = t.mock.fn(async (args: any) => ({
      id: "doc-1",
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    (prisma.document as any).create = createMock;
    t.after(() => {
      (prisma.document as any).create = originalCreate;
    });
    t.mock.method(eventBus, "emit", async () => {});

    const validPdf = Buffer.from("%PDF-1.4\n% valid pdf\n%%EOF\n");
    const result = await service.upload(
      "org-1",
      "user-1",
      makeFile("contract.pdf", "application/pdf", validPdf)
    );

    assert.equal(result.name, "contract.pdf");
    assert.equal(uploadMock.mock.callCount(), 1);
    assert.equal(createMock.mock.callCount(), 1);
  });

  await t.test(
    "rejects a non-PDF file renamed to .pdf with 400 and writes nothing to storage or DB",
    async (t) => {
      const service = new DocumentService();
      const uploadMock = t.mock.method(
        StorageClient.prototype,
        "upload",
        async () => {
          throw new Error("storage.upload should not be called");
        }
      );
      const originalCreate = prisma.document.create;
      const createMock = t.mock.fn(async () => {
        throw new Error("prisma.document.create should not be called");
      });
      (prisma.document as any).create = createMock;
      t.after(() => {
        (prisma.document as any).create = originalCreate;
      });

      // Windows PE executable header ("MZ...") disguised as .pdf
      const exeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
      await assert.rejects(
        () =>
          service.upload(
            "org-1",
            "user-1",
            makeFile("malware.pdf", "application/pdf", exeBuffer)
          ),
        (err: unknown) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.code === "BAD_REQUEST"
      );

      assert.equal(uploadMock.mock.callCount(), 0);
      assert.equal(createMock.mock.callCount(), 0);
    }
  );

  await t.test(
    "rejects a wrong MIME type with 400 and writes nothing to storage or DB",
    async (t) => {
      const service = new DocumentService();
      const uploadMock = t.mock.method(
        StorageClient.prototype,
        "upload",
        async () => {
          throw new Error("storage.upload should not be called");
        }
      );
      const originalCreate = prisma.document.create;
      const createMock = t.mock.fn(async () => {
        throw new Error("prisma.document.create should not be called");
      });
      (prisma.document as any).create = createMock;
      t.after(() => {
        (prisma.document as any).create = originalCreate;
      });

      const validHeader = Buffer.from("%PDF-1.4\n%%EOF\n");
      await assert.rejects(
        () =>
          service.upload(
            "org-1",
            "user-1",
            makeFile("contract.txt", "text/plain", validHeader)
          ),
        (err: unknown) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.code === "BAD_REQUEST"
      );

      assert.equal(uploadMock.mock.callCount(), 0);
      assert.equal(createMock.mock.callCount(), 0);
    }
  );

  await t.test(
    "route rejects oversized file (> MAX_FILE_SIZE) with 413 and invalid files with 400",
    async (t) => {
      const uploadMock = t.mock.method(
        StorageClient.prototype,
        "upload",
        async () => {
          throw new Error("storage.upload should not be called");
        }
      );
      const originalCreate = prisma.document.create;
      const createMock = t.mock.fn(async () => {
        throw new Error("prisma.document.create should not be called");
      });
      (prisma.document as any).create = createMock;
      t.after(() => {
        (prisma.document as any).create = originalCreate;
      });

      const server = http.createServer(createTestApp());
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const oversized = Buffer.alloc(MAX_FILE_SIZE + 1, 0x25);
        const res413 = await postFile(
          baseUrl,
          "huge.pdf",
          "application/pdf",
          oversized
        );
        assert.equal(res413.status, 413);
        const body413 = (await res413.json()) as { code: string };
        assert.equal(body413.code, "PAYLOAD_TOO_LARGE");

        const exeRes = await postFile(
          baseUrl,
          "renamed.pdf",
          "application/pdf",
          Buffer.from("MZ\x90\x00\x03\x00")
        );
        assert.equal(exeRes.status, 400);

        const mimeRes = await postFile(
          baseUrl,
          "notes.txt",
          "text/plain",
          Buffer.from("%PDF-1.4\n")
        );
        assert.equal(mimeRes.status, 400);

        assert.equal(uploadMock.mock.callCount(), 0);
        assert.equal(createMock.mock.callCount(), 0);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve()))
        );
      }
    }
  );
});
