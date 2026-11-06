import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

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

const MAX_RENDER_WIDTH = 860;

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
  const loadedRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Load + render the PDF pages once.
  useEffect(() => {
    let cancelled = false;
    let task: pdfjsLib.PDFDocumentLoadingTask | null = null;

    (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load document");
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
        slot.className = "page-slot relative mb-5 mx-auto rounded shadow-md bg-white";
        slot.style.width = `${viewport.width}px`;
        slot.dataset.page = String(i);

        if (modeRef.current === "place") {
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
        canvas.className = "block";
        slot.appendChild(canvas);

        const label = document.createElement("span");
        label.className =
          "absolute top-2 right-3 text-[11px] bg-gray-900/60 text-white rounded px-2 py-0.5";
        label.textContent = `Page ${i}`;
        slot.appendChild(label);

        container.appendChild(slot);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }

      loadedRef.current = true;
      onLoaded?.(pdf.numPages, dimsRef.current[1]);
    })().catch(() => {
      loadedRef.current = false;
    });

    return () => {
      cancelled = true;
      task?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Draw the "SIGN HERE" overlay for the placed field — does not re-render the PDF.
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
      "signature-overlay absolute border-2 border-dashed flex items-center justify-center font-semibold";
    overlay.style.borderColor = "#e11d48";
    overlay.style.color = "#e11d48";
    overlay.style.left = `${(placement.x / dims.width) * 100}%`;
    overlay.style.top = `${(placement.y / dims.height) * 100}%`;
    overlay.style.width = "26%";
    overlay.style.minHeight = "52px";
    overlay.style.fontSize = "13px";
    overlay.style.pointerEvents = "none";
    overlay.style.textShadow = "0 0 2px #fff, 0 0 2px #fff";
    overlay.textContent = "SIGN HERE";
    slot.appendChild(overlay);
  }, [placement, mode]);

  useEffect(() => {
    return () => {
      pdfRef.current?.destroy();
      pdfRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  return (
    <div ref={containerRef} className="py-4" data-viewer-loaded={loadedRef.current} />
  );
}