import { useEffect, useRef, useState } from "react";
import { RotateCcw, PenTool } from "lucide-react";

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

const WIDTH = 640;
const HEIGHT = 220;

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#1e40af"; // High-quality blue signature ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emit = () => {
    const data = hasInkRef.current ? canvasRef.current!.toDataURL("image/png") : null;
    onChange(data);
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    hasInkRef.current = true;
    setHasDrawn(true);
    lastRef.current = getPos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    const last = lastRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastRef.current = pos;
  };

  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    emit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    hasInkRef.current = false;
    setHasDrawn(false);
    emit();
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden shadow-inner focus-within:border-brand-500 transition-colors">
        {!hasDrawn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 gap-1.5 select-none">
            <PenTool size={14} className="text-slate-300" />
            <span>Draw your signature with finger, stylus or mouse</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          className="mx-auto block h-40 cursor-crosshair touch-none w-full"
          style={{ maxWidth: WIDTH }}
        />

        {/* Ink indicator */}
        <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          Blue ballpoint ink
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
        >
          <RotateCcw size={13} />
          Clear Pad
        </button>
      </div>
    </div>
  );
}
