// Renders a typed name into a transparent PNG data URL so the "type" signature
// looks like a signature on the sealed PDF, not plain Helvetica text.
export function renderTypedSignature(name: string): string | null {
  try {
    const width = 700;
    const height = 220;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, width, height);
    ctx.font =
      "italic 110px 'Segoe Script','Brush Script MT','Lucida Handwriting','Comic Sans MS',cursive";
    ctx.fillStyle = "#1a1a2e";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(name);
    const textWidth = metrics.width;
    if (textWidth === 0 || textWidth > width - 40) return null;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.03);
    ctx.fillText(name, -textWidth / 2, 0);

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}