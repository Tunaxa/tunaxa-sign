import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

const WIDTH = 640;
const HEIGHT = 240;

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);

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
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emit = () => {
    onChange(hasInkRef.current ? canvasRef.current!.toDataURL("image/png") : null);
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    hasInkRef.current = true;
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
    emit();
  };

  return (
    <div>
      <div className="relative rounded-lg border border-gray-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          className="mx-auto block h-48 cursor-crosshair touch-none"
          style={{ width: "100%", maxWidth: WIDTH }}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <Eraser size={14} />
          Clear
        </button>
      </div>
    </div>
  );
}