import { useState, useEffect } from "react";
import { Button, Input } from "@axa-sign/ui";
import {
  type Participant,
  type ParticipantType,
  useAddParticipant,
  useUpdateParticipant,
} from "@/hooks/use-contracts";
import {
  X,
  User,
  Mail,
  Briefcase,
  PenTool,
  CheckCircle,
  Copy,
  Eye,
  AlertCircle,
  Layers,
} from "lucide-react";

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  participantToEdit?: Participant | null;
  defaultOrder?: number;
}

const PARTICIPANT_TYPES: Array<{
  value: ParticipantType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeColor: string;
}> = [
  {
    value: "SIGNER",
    label: "Signataire",
    description: "Reçoit le lien pour apposer sa signature légale",
    icon: PenTool,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "APPROVER",
    label: "Approbateur",
    description: "Vérifie et valide l'accord avant les signatures",
    icon: CheckCircle,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "CC",
    label: "En copie (CC)",
    description: "Reçoit une copie certifiée après exécution",
    icon: Copy,
    badgeColor: "bg-slate-50 text-slate-700 border-slate-200",
  },
  {
    value: "VIEWER",
    label: "Observateur",
    description: "Peut consulter le document en lecture seule",
    icon: Eye,
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

export function ParticipantModal({
  isOpen,
  onClose,
  contractId,
  participantToEdit,
  defaultOrder = 1,
}: ParticipantModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState<ParticipantType>("SIGNER");
  const [signingOrder, setSigningOrder] = useState<number>(defaultOrder);
  const [error, setError] = useState<string | null>(null);

  const addParticipant = useAddParticipant();
  const updateParticipant = useUpdateParticipant();

  const isEditing = !!participantToEdit;

  useEffect(() => {
    if (participantToEdit) {
      setName(participantToEdit.name);
      setEmail(participantToEdit.email);
      setRole(participantToEdit.role || "");
      setType(participantToEdit.type || "SIGNER");
      setSigningOrder(participantToEdit.signingOrder ?? defaultOrder);
    } else {
      setName("");
      setEmail("");
      setRole("");
      setType("SIGNER");
      setSigningOrder(defaultOrder);
    }
    setError(null);
  }, [participantToEdit, defaultOrder, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Le nom complet est obligatoire.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Veuillez saisir une adresse email valide.");
      return;
    }

    try {
      if (isEditing && participantToEdit) {
        await updateParticipant.mutateAsync({
          id: participantToEdit.id,
          contractId,
          data: {
            name: name.trim(),
            email: email.trim(),
            role: role.trim() || undefined,
            type,
            signingOrder,
          },
        });
      } else {
        await addParticipant.mutateAsync({
          contractId,
          name: name.trim(),
          email: email.trim(),
          role: role.trim() || undefined,
          type,
          signingOrder,
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'enregistrement du participant.";
      setError(msg);
    }
  };

  const isSubmitting = addParticipant.isPending || updateParticipant.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-participant-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal border border-slate-100 animate-slide-in relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-xs">
              <User size={20} />
            </div>
            <div>
              <h3 id="modal-participant-title" className="text-base font-bold text-slate-900">
                {isEditing ? "Modifier le participant" : "Ajouter un participant"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Désignez un signataire, approbateur ou observateur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
            aria-label="Fermer"
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Email in grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nom complet"
              placeholder="Ex : Sarah Martin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              disabled={isSubmitting}
              leftIcon={<User size={15} />}
            />
            <Input
              label="Adresse email"
              type="email"
              placeholder="sarah@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              leftIcon={<Mail size={15} />}
            />
          </div>

          {/* Role & Signing Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Fonction / Titre (facultatif)"
                placeholder="Ex : Directrice Juridique, Client"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
                leftIcon={<Briefcase size={15} />}
              />
            </div>
            <div>
              <Input
                label="Ordre"
                type="number"
                min={1}
                max={50}
                value={signingOrder}
                onChange={(e) => setSigningOrder(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={isSubmitting}
                leftIcon={<Layers size={15} />}
                hint="Étape de signature"
              />
            </div>
          </div>

          {/* Type Selector (SIGNER, APPROVER, CC, VIEWER) */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Rôle du participant
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PARTICIPANT_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    disabled={isSubmitting}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{t.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        {t.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mt-6">
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
            >
              {isEditing ? "Enregistrer les modifications" : "Ajouter le participant"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
