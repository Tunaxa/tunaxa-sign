// Renders a typed name into a transparent PNG data URL with authentic blue ink
// so the "typed" signature looks like an authentic ballpoint pen signature on the sealed PDF.
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
      "italic 96px 'Dancing Script', 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
    ctx.fillStyle = "#1e40af"; // Deep blue ink
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(name);
    const textWidth = metrics.width;
    if (textWidth === 0 || textWidth > width - 40) return null;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.025); // Natural human angle
    ctx.fillText(name, -textWidth / 2, 0);

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
