import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, AlertCircle, PenTool } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface Placement {
  page: number; // 1-based
  x: number; // PDF points from page left
  y: number; // PDF points from page top
}

interface PageDims {
  width: number;
  height: number;
}

interface DocumentViewerProps {
  url: string;
  mode: "view" | "place";
  placement?: Placement | null;
  onPlace?: (placement: Placement) => void;
  onLoaded?: (pageCount: number, firstPage: PageDims) => void;
}

const MAX_RENDER_WIDTH = 840;

export function DocumentViewer({
  url,
  mode,
  placement,
  onPlace,
  onLoaded,
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const dimsRef = useRef<Record<number, PageDims>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Load and render PDF pages
  useEffect(() => {
    let cancelled = false;
    let task: pdfjsLib.PDFDocumentLoadingTask | null = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Document unavailable or signing session expired.");
        const data = await res.arrayBuffer();

        task = pdfjsLib.getDocument({ data });
        const pdf = await task.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        dimsRef.current = {};
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          dimsRef.current[i] = { width: base.width, height: base.height };

          const scale = Math.min(1.5, MAX_RENDER_WIDTH / base.width);
          const viewport = page.getViewport({ scale });

          const slot = document.createElement("div");
          slot.className = "page-slot relative mb-6 mx-auto rounded-xl shadow-card bg-white border border-slate-200 overflow-hidden";
          slot.style.width = `${viewport.width}px`;
          slot.dataset.page = String(i);

          if (modeRef.current === "place") {
            slot.style.cursor = "crosshair";
            slot.addEventListener("click", (event) => {
              const rect = slot.getBoundingClientRect();
              const xPct = (event.clientX - rect.left) / rect.width;
              const yPct = (event.clientY - rect.top) / rect.height;
              const dims = dimsRef.current[i];
              onPlace?.({ page: i, x: xPct * dims.width, y: yPct * dims.height });
            });
          }

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block w-full";
          slot.appendChild(canvas);

          // Page number badge
          const label = document.createElement("span");
          label.className =
            "absolute top-3 right-3 text-[11px] font-semibold bg-slate-900/70 backdrop-blur-sm text-white rounded-full px-2.5 py-0.5 shadow-sm";
          label.textContent = `Page ${i} of ${pdf.numPages}`;
          slot.appendChild(label);

          container.appendChild(slot);

          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        }

        setLoading(false);
        onLoaded?.(pdf.numPages, dimsRef.current[1]);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render PDF document.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [url]);

  // Render the "SIGN HERE" placement overlay on the placed page slot
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container
      .querySelectorAll<HTMLElement>(".signature-overlay")
      .forEach((el) => el.remove());

    if (mode !== "place" || !placement) return;

    const slot = Array.from(container.querySelectorAll<HTMLElement>(".page-slot")).find(
      (s) => Number(s.dataset.page) === placement.page
    );
    if (!slot) return;

    const dims = dimsRef.current[placement.page];
    if (!dims) return;

    const overlay = document.createElement("div");
    overlay.className =
      "signature-overlay absolute border-2 border-dashed border-blue-600 bg-blue-500/15 rounded-lg flex items-center justify-center font-bold text-blue-700 shadow-md select-none transition-all";
    overlay.style.left = `${(placement.x / dims.width) * 100}%`;
    overlay.style.top = `${(placement.y / dims.height) * 100}%`;
    overlay.style.width = "28%";
    overlay.style.minHeight = "48px";
    overlay.style.fontSize = "12px";
    overlay.style.pointerEvents = "none";
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2563eb;animation:pulse 1.5s infinite;"></span>
        SIGN HERE
      </div>
    `;
    slot.appendChild(overlay);
  }, [placement, mode]);

  useEffect(() => {
    return () => {
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, []);

  return (
    <div className="relative py-4">
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Loader2 className="animate-spin text-brand-600 mb-3" size={32} />
          <p className="text-sm font-medium">Loading and verifying document cryptographic hash...</p>
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 my-8">
          <AlertCircle size={32} className="mx-auto mb-2 text-red-500" />
          <h3 className="font-semibold text-sm">Unable to display agreement</h3>
          <p className="text-xs mt-1 text-red-600">{error}</p>
        </div>
      )}

      <div ref={containerRef} className={loading || error ? "hidden" : "block"} />
    </div>
  );
}
