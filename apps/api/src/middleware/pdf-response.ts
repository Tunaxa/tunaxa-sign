import type { Response } from "express";

/**
 * Removes characters that are unsafe in a Content-Disposition filename parameter:
 * - Strips quotes, CR, LF, backslash, and path separators
 * - Replaces non-ASCII with their nearest ASCII equivalent (via ASCII fallback)
 * - Strips any characters still outside US-ASCII after normalization
 * - Truncates to 200 characters
 * - Falls back to "document" if the result is empty
 */
export function sanitizeFilename(raw: string): string {
  const normalized = raw
    .normalize("NFD")               // decompose accented chars
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/["\r\n\\/]/g, "")     // strip unsafe header chars
    .replace(/[^\x20-\x7E]/g, "")  // strip remaining non-ASCII
    .trim()
    .slice(0, 200);
  return normalized.length > 0 ? normalized : "document";
}

/**
 * Sends a PDF buffer as a downloadable attachment.
 * Sets Content-Type, Content-Disposition (attachment with sanitized filename),
 * Cache-Control, Content-Length, and writes the buffer.
 */
export function sendPdfAttachment(res: Response, buffer: Buffer, filename: string): void {
  const safe = sanitizeFilename(filename);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
}
