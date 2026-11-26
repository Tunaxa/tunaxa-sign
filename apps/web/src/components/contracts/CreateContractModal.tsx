import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "@axa-sign/ui";
import { api } from "@/lib/api";
import type { Contract } from "@/hooks/use-contracts";
import {
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  FileUp,
  Trash2,
  BookOpen,
} from "lucide-react";

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export async function countPdfPages(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder("latin1");

    const chunkSize = 128 * 1024;
    let text = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      text += decoder.decode(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    }

    // 1. Direct Page objects: /Type /Page (excluding /Type /Pages)
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }

    // 2. Fallback: /Count N in Pages catalog
    const countMatches = [...text.matchAll(/\/Count\s+(\d+)/g)];
    if (countMatches.length > 0) {
      const counts = countMatches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n));
      if (counts.length > 0) {
        return Math.max(...counts);
      }
    }

    return 1;
  } catch (err) {
    console.warn("Could not determine PDF page count:", err);
    return 1;
  }
}

export function CreateContractModal({ isOpen, onClose }: CreateContractModalProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isCountingPages, setIsCountingPages] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload & Creation progress state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStepText, setUploadStepText] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setTitle("");
      setSelectedFile(null);
      setPageCount(null);
      setError(null);
      setIsSubmitting(false);
      setUploadPercent(0);
      setUploadStepText("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateAndSetFile = async (file: File) => {
    setError(null);

    // Validate type (must be PDF)
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Seuls les fichiers PDF (.pdf) sont acceptés.");
      return;
    }

    // Validate size (max 50 Mo)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `Le fichier dépasse la limite maximale autorisée de 50 Mo (${formatFileSize(file.size)}).`
      );
      return;
    }

    setSelectedFile(file);

    // Auto-fill title if empty or default
    if (!title.trim()) {
      const suggestedTitle = file.name
        .replace(/\.pdf$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (suggestedTitle) {
        setTitle(suggestedTitle);
      }
    }

    // Calculate number of pages
    setIsCountingPages(true);
    const pages = await countPdfPages(file);
    setPageCount(pages);
    setIsCountingPages(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await validateAndSetFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await validateAndSetFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPageCount(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Veuillez renseigner un titre pour le contrat.");
      return;
    }
    if (!selectedFile) {
      setError("Veuillez sélectionner ou glisser-déposer un document PDF.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setUploadPercent(5);
    setUploadStepText("Création du contrat...");

    try {
      // Step 1: Create Contract via API
      const contract = await api.post<Contract>("/contracts", {
        title: title.trim(),
        source: "MANUAL",
      });

      setUploadPercent(20);
      setUploadStepText("Envoi et scellement du fichier PDF...");

      // Step 2: Upload PDF Document linked to Contract
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("contractId", contract.id);

      await api.upload<{ id: string }>("/documents", formData, (percent) => {
        // Map 0-100% upload to 20%-95% total progress
        const overall = 20 + Math.round(percent * 0.75);
        setUploadPercent(overall);
        setUploadStepText(`Téléversement du PDF (${percent}%)...`);
      });

      setUploadPercent(100);
      setUploadStepText("Finalisation et redirection...");

      // Step 3: Redirect to /contracts/:id
      setTimeout(() => {
        onClose();
        navigate(`/contracts/${contract.id}`);
      }, 400);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'import du contrat.";
      setError(message);
      setIsSubmitting(false);
      setUploadPercent(0);
      setUploadStepText("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-contract-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-modal border border-slate-100 animate-slide-in relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-xs">
              <FileUp size={22} />
            </div>
            <div>
              <h3 id="modal-contract-title" className="text-base font-bold text-slate-900">
                Nouveau contrat avec document PDF
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Glissez-déposez votre accord pour préparer les signatures
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
            aria-label="Fermer la modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 animate-fade-in"
          >
            <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Contract Title Input */}
          <Input
            label="Titre du contrat"
            placeholder="Ex : Accord de Confidentialité (NDA) 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            required
            hint="Ce titre sera visible par tous les participants et sur le certificat de signature."
          />

          {/* Drag & Drop Zone / Preview */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Document PDF <span className="text-red-500">*</span>
            </label>

            {!selectedFile ? (
              /* Drag and drop active area */
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-brand-500 bg-brand-50/60 scale-[1.01]"
                    : "border-slate-300 bg-slate-50/50 hover:border-brand-400 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-brand-600 group-hover:scale-105 transition-transform">
                  <UploadCloud size={28} />
                </div>

                <p className="text-sm font-semibold text-slate-800">
                  <span className="text-brand-600 hover:underline">Cliquez pour parcourir</span> ou
                  glissez-déposez ici
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Format <span className="font-semibold text-slate-700">PDF uniquement</span> (jusqu'à 50 Mo)
                </p>

                <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Validation instantanée
                  </span>
                  <span>•</span>
                  <span>Calcul automatique des pages</span>
                </div>
              </div>
            ) : (
              /* PDF Selected Preview Card */
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 shadow-xs border border-red-200">
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-medium text-slate-700">
                          {formatFileSize(selectedFile.size)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-brand-700 font-semibold bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200/50">
                          <BookOpen size={12} />
                          {isCountingPages ? (
                            "Calcul des pages..."
                          ) : (
                            `${pageCount ?? 1} page${(pageCount ?? 1) > 1 ? "s" : ""}`
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isSubmitting && (
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Supprimer ce fichier"
                      aria-label="Supprimer ce fichier"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar (Visible during creation & upload) */}
          {isSubmitting && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                <span>{uploadStepText}</span>
                <span>{uploadPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/70">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-300 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>

            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!selectedFile || !title.trim()}
              leftIcon={<FileUp size={16} />}
            >
              {isSubmitting ? "Importation en cours..." : "Créer et importer le contrat"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
