import { useEffect, useRef } from "react";
import { Button } from "@axa-sign/ui";
import {
  Send,
  X,
  FileText,
  Users,
  AlertTriangle,
  XCircle,
  PenTool,
  CheckCircle,
  Copy,
  Eye,
} from "lucide-react";
import type { Participant } from "@/hooks/use-contracts";

interface SendConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  contractTitle: string;
  documentName?: string;
  documentSize?: number;
  participants: Participant[];
  isLoading: boolean;
  errorMessage?: string | null;
}

export function SendConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  contractTitle,
  documentName,
  documentSize,
  participants,
  isLoading,
  errorMessage,
}: SendConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const sortedParticipants = [...participants].sort(
    (a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0)
  );

  const signers = sortedParticipants.filter(
    (p) => (p.type || "SIGNER") === "SIGNER"
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  const getRoleIcon = (type?: string) => {
    switch (type) {
      case "APPROVER":
        return <CheckCircle size={12} className="text-emerald-600" />;
      case "CC":
        return <Copy size={12} className="text-slate-500" />;
      case "VIEWER":
        return <Eye size={12} className="text-purple-600" />;
      case "SIGNER":
      default:
        return <PenTool size={12} className="text-brand-600" />;
    }
  };

  const getRoleLabel = (type?: string) => {
    switch (type) {
      case "APPROVER":
        return "Approbateur";
      case "CC":
        return "En copie";
      case "VIEWER":
        return "Observateur";
      case "SIGNER":
      default:
        return "Signataire";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl bg-white shadow-modal border border-slate-100 overflow-hidden animate-slide-in my-8"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-linear-to-r from-brand-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-500/20">
              <Send size={18} />
            </div>
            <div>
              <h2 id="send-confirm-title" className="text-base font-bold text-slate-900">
                Envoyer pour signature
              </h2>
              <p className="text-xs text-slate-500">
                Confirmation du déclenchement du circuit de signature
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Fermer la modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* API Error Alert if send failed */}
          {errorMessage && (
            <div
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-xs text-red-800 animate-fade-in"
              role="alert"
            >
              <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Échec de l'envoi du contrat :</span>
                <p className="text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Contract & Document Overview Card */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Contrat à initier
                </span>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {contractTitle}
                </h3>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/50">
                eIDAS Qualifié
              </span>
            </div>

            {/* Document Info */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
              <FileText size={15} className="text-brand-600 shrink-0" />
              <span className="font-semibold text-slate-800 truncate">
                {documentName || `${contractTitle}.pdf`}
              </span>
              {documentSize && (
                <span className="text-[11px] text-slate-400 shrink-0">
                  ({formatFileSize(documentSize)})
                </span>
              )}
            </div>
          </div>

          {/* Sequential Signing Circuit Summary */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={14} className="text-brand-600" />
                Circuit de signature ({signers.length} signataire{signers.length > 1 ? "s" : ""})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {sortedParticipants.length > 1 ? "Ordre séquentiel" : "Signature directe"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/70 divide-y divide-slate-100 overflow-hidden bg-white">
              {sortedParticipants.map((p, idx) => {
                const roleLabel = getRoleLabel(p.type);
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 text-xs gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                        {p.signingOrder ?? idx + 1}
                      </span>
                      <div className="min-w-0 truncate">
                        <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{p.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.role && (
                        <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/50">
                          {p.role}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {getRoleIcon(p.type)}
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legal / Operational Notice */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900">
            <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900">
                Attention : Action irréversible
              </p>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Dès confirmation, des invitations sécurisées avec jetons chiffrés à usage unique seront transmises aux participants par email. Le contrat passera au statut <strong>« En attente de signature »</strong> et les signataires ne pourront plus être modifiés ni réordonnés.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button
            variant="secondary"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isLoading}
            onClick={onConfirm}
            leftIcon={<Send size={14} />}
          >
            Confirmer et envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}
