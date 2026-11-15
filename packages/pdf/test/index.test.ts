import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { sha256 } from "@axa-sign/shared";

import { applySignatures } from "../src/index.js";

const SIGNATURE_PNG =
  "data:image/png;base64," +
  "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";

async function makePdf(pageCount: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Seal regression page ${index + 1}`, {
      x: 50,
      y: 730,
      size: 18,
      font,
      color: rgb(0.05, 0.05, 0.12),
    });
  }
  return Buffer.from(await pdf.save());
}

test("applySignatures seals a multipage PDF and embeds a PNG signature", async () => {
  const original = await makePdf(2);
  const result = await applySignatures(original, [
    {
      page: 1,
      x: 100,
      y: 100,
      width: 160,
      height: 50,
      name: "Fidaa Brahmi",
      date: new Date("2026-11-14T12:00:00.000Z"),
      imageData: SIGNATURE_PNG,
    },
  ]);

  assert.equal(result.signatureCount, 1);
  assert.equal(result.sha256After, sha256(result.buffer));
  assert.ok(result.buffer.length > original.length);

  const sealed = await PDFDocument.load(result.buffer);
  assert.equal(sealed.getPageCount(), 2);
  assert.equal(sealed.getTitle(), undefined);
});

test("applySignatures rejects an out-of-range page", async () => {
  const original = await makePdf(1);
  await assert.rejects(
    applySignatures(original, [
      {
        page: 2,
        x: 100,
        y: 100,
        width: 160,
        height: 50,
        name: "Fidaa Brahmi",
      },
    ]),
    /Invalid page number: 2/
  );
});
