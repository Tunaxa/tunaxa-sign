import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { sha256 } from "@axa-sign/shared";

export interface SignaturePlacement {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  date?: Date;
  imageData?: string; // PNG or JPEG base64 data URL
}

export interface PdfSignResult {
  buffer: Buffer;
  sha256After: string;
  signatureCount: number;
}

export interface CertificateOptions {
  contractTitle: string;
  contractId: string;
  documentHash: string;
  completedAt: Date;
  participants: Array<{
    name: string;
    email: string;
    role: string;
    signedAt: Date;
  }>;
  serialNumber: string;
  issuer: string;
}

/**
 * Applies one or more signatures to a PDF and returns the sealed buffer.
 */
export async function applySignatures(
  pdfBuffer: Buffer,
  placements: SignaturePlacement[]
): Promise<PdfSignResult> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const p of placements) {
    if (p.page < 1 || p.page > pdfDoc.getPageCount()) {
      throw new Error(`Invalid page number: ${p.page}`);
    }

    const page = pdfDoc.getPage(p.page - 1);
    const { width, height } = page.getSize();

    // Place a signature box
    page.drawRectangle({
      x: p.x,
      y: height - p.y - p.height,
      width: p.width,
      height: p.height,
      borderColor: rgb(0.1, 0.1, 0.18),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 1),
    });

    // Embed the image before text so opaque signature backgrounds do not hide the timestamp.
    if (p.imageData) {
      try {
        const img = await embedImage(pdfDoc, p.imageData);
        if (img) {
          page.drawImage(img, {
            x: p.x + 2,
            y: height - p.y - p.height + 2,
            width: p.width - 4,
            height: Math.min(p.height - 4, (p.width - 4) * 0.4),
          });
        }
      } catch {
        // Fall back to text-only signature if image fails
      }
    }

    // Draw name in script-style vicinity
    page.drawText(p.name, {
      x: p.x + 6,
      y: height - p.y - p.height + 8,
      size: 14,
      font,
      color: rgb(0.05, 0.05, 0.12),
    });

    // Draw timestamp
    const timestamp = (p.date || new Date()).toISOString();
    page.drawText(timestamp, {
      x: p.x + 6,
      y: height - p.y - p.height + 24,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.5),
    });
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  const buffer = Buffer.from(bytes);

  return {
    buffer,
    sha256After: sha256(buffer),
    signatureCount: placements.length,
  };
}

/**
 * Generates a completion certificate PDF with all signing evidence.
 */
export async function generateCertificate(
  options: CertificateOptions
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1 — Certificate
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  // Border
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: rgb(0.1, 0.1, 0.18),
    borderWidth: 2,
  });

  // Header
  page.drawText("CERTIFICATE OF COMPLETION", {
    x: 156,
    y: height - 100,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.18),
  });

  page.drawText("AXA SIGN — Document Signing Service", {
    x: 190,
    y: height - 120,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.5),
  });

  // Serial
  page.drawText(`Serial Number: ${options.serialNumber}`, {
    x: 70,
    y: height - 160,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.5),
  });

  // Contract info
  page.drawText(options.contractTitle, {
    x: 70,
    y: height - 200,
    size: 14,
    font: boldFont,
  });

  page.drawText(`Contract ID: ${options.contractId}`, {
    x: 70,
    y: height - 220,
    size: 9,
    font,
  });

  page.drawText(`Document SHA-256: ${options.documentHash}`, {
    x: 70,
    y: height - 235,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.5),
  });

  page.drawText(`Completed: ${options.completedAt.toISOString()}`, {
    x: 70,
    y: height - 255,
    size: 9,
    font,
  });

  // Participants section
  page.drawText("Participants", {
    x: 70,
    y: height - 290,
    size: 12,
    font: boldFont,
  });

  let y = height - 315;
  for (const p of options.participants) {
    page.drawText(`• ${p.name}  (${p.email})`, {
      x: 85,
      y,
      size: 10,
      font,
    });
    page.drawText(p.role.toUpperCase(), {
      x: 420,
      y,
      size: 9,
      font,
    });
    page.drawText(p.signedAt.toISOString().slice(0, 16), {
      x: 300,
      y: y - 14,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.5),
    });
    y -= 32;
  }

  // Signature block
  page.drawText("Issued by AXA Sign (Tunaxa)", {
    x: 70,
    y: 110,
    size: 9,
    font,
  });

  // Issuer signature line
  page.drawLine({
    start: { x: 70, y: 95 },
    end: { x: 250, y: 95 },
  });

  return Buffer.from(await pdfDoc.save());
}

/**
 * Generates a document thumbnail (simple text bridge — real rendering uses a worker).
 */
export async function extractPdfMetadata(pdfBuffer: Buffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle() || undefined,
    author: pdfDoc.getAuthor() || undefined,
    subject: pdfDoc.getSubject() || undefined,
    creator: pdfDoc.getCreator() || undefined,
    hasEncryption: pdfDoc.isEncrypted,
    approximateSize: pdfBuffer.length,
  };
}

/**
 * Validates a PDF buffer is parseable and within limits.
 */
export async function validatePdf(pdfBuffer: Buffer): Promise<{ valid: boolean; error?: string }> {
  if (pdfBuffer.byteLength > 50 * 1024 * 1024) {
    return { valid: false, error: "PDF exceeds maximum size of 50MB" };
  }
  try {
    await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid or corrupt PDF file" };
  }
}

async function embedImage(pdfDoc: PDFDocument, imageData: string) {
  const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/i, "");
  let bytes: Uint8Array;
  let isPng = false;

  const mimeMatch = imageData.match(/data:image\/([a-z]+);base64,/i);
  const mime = mimeMatch?.[1]?.toLowerCase();
  bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  isPng = mime === "png";

  if (isPng) {
    return pdfDoc.embedPng(bytes);
  }
  return pdfDoc.embedJpg(bytes);
}