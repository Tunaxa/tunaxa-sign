import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useContract,
  useSendContract,
  useCancelContract,
  useDeleteParticipant,
  useUpdateParticipant,
  type Participant,
} from "@/hooks/use-contracts";
import { ParticipantModal } from "@/components/contracts/ParticipantModal";
import { SendConfirmModal } from "@/components/contracts/SendConfirmModal";
import { Button, StatusBadge, Card } from "@axa-sign/ui";
import { format } from "date-fns";
import {
  ArrowLeft,
  Send,
  XCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Calendar,
  Layers,
  FileCheck,
  FileText,
  UserPlus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  PenTool,
  CheckCircle,
  Copy,
  Eye,
  AlertTriangle,
  Users,
} from "lucide-react";

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isLoading } = useContract(id!);
  const sendContract = useSendContract();
  const cancelContract = useCancelContract();
  const deleteParticipant = useDeleteParticipant();
  const updateParticipant = useUpdateParticipant();

  // Participant Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Send Confirmation Modal & Guard States (AXS-017)
  const [isSendConfirmOpen, setIsSendConfirmOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-28 bg-white rounded-2xl border border-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white rounded-2xl border border-slate-200" />
          <div className="h-72 bg-white rounded-2xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 mb-4">
          <XCircle size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Contrat introuvable</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          L'accord demandé n'existe pas ou vous n'avez pas l'autorisation d'y accéder.
        </p>
        <Link
          to="/contracts"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <ArrowLeft size={15} /> Retourner à la liste des contrats
        </Link>
      </div>
    );
  }

  const isDraft = contract.status === "DRAFT";
  const sortedParticipants = [...contract.participants].sort(
    (a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0)
  );

  // Guards for "Envoyer pour signature" (AXS-017)
  const latestVersion = contract.versions?.[0];
  const documentInfo = latestVersion?.document;
  const hasDocument = Boolean(
    (contract.versions && contract.versions.length > 0) ||
    (contract._count?.versions && contract._count.versions > 0)
  );

  const signers = sortedParticipants.filter(
    (p) => (p.type || "SIGNER") === "SIGNER"
  );
  const hasSigner = signers.length > 0;
  const canSend = hasDocument && hasSigner;

  const getSendTooltip = () => {
    if (!hasDocument && !hasSigner) {
      return "Document PDF manquant et aucun signataire (rôle Signataire) désigné.";
    }
    if (!hasDocument) {
      return "Veuillez associer un document PDF avant de pouvoir envoyer ce contrat.";
    }
    if (!hasSigner) {
      return "Veuillez désigner au moins un participant ayant le rôle « Signataire » pour envoyer le contrat.";
    }
    return "Déclencher l'envoi officiel du contrat aux signataires";
  };

  const handleOpenSendModal = () => {
    if (!canSend) return;
    setSendError(null);
    setIsSendConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!contract || !canSend) return;
    try {
      setSendError(null);
      await sendContract.mutateAsync(contract.id);
      setIsSendConfirmOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi du contrat.";
      setSendError(msg);
    }
  };

  const handleOpenAdd = () => {
    setEditingParticipant(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Participant) => {
    setEditingParticipant(p);
    setIsModalOpen(true);
  };

  const handleDelete = async (participantId: string) => {
    try {
      setActionError(null);
      await deleteParticipant.mutateAsync({ id: participantId, contractId: contract.id });
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
    }
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    if (!isDraft) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedParticipants.length) return;

    const currentP = sortedParticipants[index];
    const targetP = sortedParticipants[targetIndex];

    try {
      setActionError(null);
      const currentOrder = currentP.signingOrder ?? index + 1;
      const targetOrder = targetP.signingOrder ?? targetIndex + 1;

      // Swap orders
      await Promise.all([
        updateParticipant.mutateAsync({
          id: currentP.id,
          contractId: contract.id,
          data: { signingOrder: targetOrder },
        }),
        updateParticipant.mutateAsync({
          id: targetP.id,
          contractId: contract.id,
          data: { signingOrder: currentOrder },
        }),
      ]);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Erreur lors du réordonnancement.");
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case "APPROVER":
        return {
          label: "Approbateur",
          icon: CheckCircle,
          className: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
        };
      case "CC":
        return {
          label: "En copie",
          icon: Copy,
          className: "bg-slate-100 text-slate-700 border-slate-200",
        };
      case "VIEWER":
        return {
          label: "Observateur",
          icon: Eye,
          className: "bg-purple-50 text-purple-700 border-purple-200/60",
        };
      case "SIGNER":
      default:
        return {
          label: "Signataire",
          icon: PenTool,
          className: "bg-blue-50 text-blue-700 border-blue-200/60",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/contracts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={15} /> Retourner aux contrats
        </Link>
      </div>

      {/* Main Contract Header Card */}
      <Card padding="lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {contract.title}
              </h1>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>Initié par {contract.creator.firstName} {contract.creator.lastName}</span>
              <span>•</span>
              <span>{format(new Date(contract.createdAt), "dd MMM yyyy 'à' HH:mm")}</span>
            </p>
          </div>

          {/* Action buttons (only in DRAFT state) */}
          {isDraft && (
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Send Button with Tooltip and Guards (AXS-017) */}
              <div
                className="relative group inline-flex"
                title={!canSend ? getSendTooltip() : undefined}
              >
                <Button
                  variant="primary"
                  onClick={handleOpenSendModal}
                  loading={sendContract.isPending}
                  disabled={!canSend || sendContract.isPending}
                  aria-disabled={!canSend}
                  leftIcon={<Send size={15} />}
                >
                  Envoyer pour signature
                </Button>

                {/* Explicit floating tooltip on hover/focus when disabled (AXS-017) */}
                {!canSend && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 rounded-xl bg-slate-900 px-3.5 py-2.5 text-center text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-30"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-amber-300 font-bold mb-1">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>Envoi verrouillé</span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-snug">
                      {getSendTooltip()}
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                )}
              </div>

              <Button
                variant="danger"
                onClick={() => cancelContract.mutate(contract.id)}
                loading={cancelContract.isPending}
                leftIcon={<XCircle size={15} />}
              >
                Annuler
              </Button>
            </div>
          )}
        </div>

        {/* Pre-Flight Checklist Banner for DRAFT status (AXS-017) */}
        {isDraft && (
          <div
            className={`mt-4 rounded-xl border p-3.5 transition-all ${
              canSend
                ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-950"
                : "border-amber-200 bg-amber-50/70 text-amber-950"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                {canSend ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold">
                    {canSend
                      ? "Garde-fous validés — Prêt pour l'envoi"
                      : "Garde-fous d'envoi non satisfaits"}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {canSend
                      ? "Le document et les signataires sont configurés. Vous pouvez déclencher le circuit de signature."
                      : "Les conditions ci-dessous doivent être réunies pour pouvoir envoyer ce contrat."}
                  </p>
                </div>
              </div>

              {/* Checklist Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                {/* 1. Document Guard */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    hasDocument
                      ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200/50"
                      : "bg-amber-100 text-amber-800 border border-amber-300/60"
                  }`}
                  title={hasDocument ? "Document PDF présent" : "Aucun fichier PDF n'est associé"}
                >
                  {hasDocument ? (
                    <CheckCircle size={13} className="text-emerald-700" />
                  ) : (
                    <XCircle size={13} className="text-amber-700" />
                  )}
                  <span>Document PDF {hasDocument ? "attaché" : "manquant"}</span>
                </div>

                {/* 2. Signer Guard */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    hasSigner
                      ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200/50"
                      : "bg-amber-100 text-amber-800 border border-amber-300/60"
                  }`}
                  title={
                    hasSigner
                      ? `${signers.length} participant(s) avec le rôle Signataire`
                      : "Au moins 1 participant doit avoir le rôle Signataire"
                  }
                >
                  {hasSigner ? (
                    <CheckCircle size={13} className="text-emerald-700" />
                  ) : (
                    <XCircle size={13} className="text-amber-700" />
                  )}
                  <span>
                    {hasSigner
                      ? `${signers.length} signataire${signers.length > 1 ? "s" : ""} (SIGNER)`
                      : "Aucun SIGNER"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Action / API Error Banner */}
        {(actionError || sendError) && (
          <div className="mt-4 flex items-center justify-between gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-red-500 shrink-0" />
              <span>{sendError || actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setSendError(null);
              }}
              className="text-red-400 hover:text-red-700 text-[11px] underline"
            >
              Fermer
            </button>
          </div>
        )}
      </Card>

      {/* Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Participants & Audit Trail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Participants Card (AXS-016) */}
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Signataires & Participants
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Circuit de signature séquentiel et gestion des rôles
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {contract.participants.length} participant{contract.participants.length !== 1 ? "s" : ""}
                </span>
                {isDraft && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenAdd}
                    leftIcon={<UserPlus size={14} />}
                  >
                    Ajouter un signataire
                  </Button>
                )}
              </div>
            </div>

            {/* Sequential order notice */}
            {sortedParticipants.length > 1 && (
              <div className="mb-4 rounded-xl bg-slate-50/80 border border-slate-100 px-3.5 py-2 text-[11px] text-slate-600 flex items-center justify-between">
                <span>
                  L'ordre de signature est respecté : chaque participant reçoit le document lorsque le précédent a signé.
                </span>
                <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                  Ordre 1 → {sortedParticipants.length}
                </span>
              </div>
            )}

            {sortedParticipants.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-3">
                  <Users size={24} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Aucun participant configuré
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Définissez les signataires, approbateurs ou personnes en copie pour ce document.
                </p>
                {isDraft && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={handleOpenAdd}
                    leftIcon={<UserPlus size={15} />}
                  >
                    Ajouter le premier signataire
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedParticipants.map((p, index) => {
                  const isSigned = p.status === "SIGNED";
                  const badge = getTypeBadge(p.type);
                  const BadgeIcon = badge.icon;
                  const initials = p.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200/70 bg-white hover:border-slate-300 hover:shadow-xs transition-all gap-4"
                    >
                      {/* Left: Order and User Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Order & Reordering controls in DRAFT */}
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700"
                            title={`Étape ${p.signingOrder ?? index + 1}`}
                          >
                            {p.signingOrder ?? index + 1}
                          </span>
                          {isDraft && sortedParticipants.length > 1 && (
                            <div className="flex gap-0.5 mt-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveOrder(index, "up")}
                                className="p-0.5 text-slate-400 hover:text-brand-600 disabled:opacity-20 transition-colors"
                                title="Monter dans l'ordre"
                                aria-label="Monter"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={index === sortedParticipants.length - 1}
                                onClick={() => handleMoveOrder(index, "down")}
                                className="p-0.5 text-slate-400 hover:text-brand-600 disabled:opacity-20 transition-colors"
                                title="Descendre dans l'ordre"
                                aria-label="Descendre"
                              >
                                <ArrowDown size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 border border-brand-200/60 font-bold text-xs text-brand-700 shadow-2xs">
                          {initials || "U"}
                        </div>

                        {/* Details */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-sm text-slate-900 truncate">{p.name}</p>
                            {p.role && (
                              <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {p.role}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${badge.className}`}
                            >
                              <BadgeIcon size={11} />
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{p.email}</p>
                        </div>
                      </div>

                      {/* Right: Status and Edit/Delete Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            isSigned
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                              : "bg-slate-100 text-slate-600 ring-slate-500/20"
                          }`}
                        >
                          {isSigned ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {p.status}
                        </span>

                        {/* Edit & Delete Buttons in DRAFT */}
                        {isDraft && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                              title="Modifier ce signataire"
                              aria-label="Modifier"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                              title="Supprimer ce signataire"
                              aria-label="Supprimer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Cryptographic Audit Trail */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                Journal des Événements & Preuves Cryptographiques
              </h2>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
                eIDAS Conforme
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 text-xs">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Brouillon de contrat créé</p>
                  <p className="text-slate-500 text-[11px]">
                    Initié par {contract.creator.firstName} {contract.creator.lastName} ({contract.creator.email})
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {format(new Date(contract.createdAt), "PPpp")}
                  </p>
                </div>
              </div>

              {contract.sentAt && (
                <div className="flex items-start gap-3 text-xs">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Invitations aux signataires transmises</p>
                    <p className="text-slate-500 text-[11px]">Jetons de session sécurisés générés et notifiés</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      {format(new Date(contract.sentAt), "PPpp")}
                    </p>
                  </div>
                </div>
              )}

              {contract.completedAt && (
                <div className="flex items-start gap-3 text-xs">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold">
                    ✓
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Contrat entièrement scellé et signé</p>
                    <p className="text-slate-500 text-[11px]">Certificat de conformité émis avec horodatage qualifié</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      {format(new Date(contract.completedAt), "PPpp")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Document Card & Metadata Overview */}
        <div className="space-y-6">
          {/* Document Card (AXS-017) */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText size={16} className="text-brand-600" />
                Document Associé
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hasDocument
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                    : "bg-amber-50 text-amber-700 border border-amber-200/50"
                }`}
              >
                {hasDocument ? "Attaché" : "Manquant"}
              </span>
            </div>

            {hasDocument ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 font-bold text-xs shrink-0">
                    PDF
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate" title={documentInfo?.name || `${contract.title}.pdf`}>
                      {documentInfo?.name || `${contract.title}.pdf`}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {documentInfo?.size
                        ? `${(documentInfo.size / (1024 * 1024)).toFixed(2)} Mo`
                        : "Fichier PDF sécurisé"}
                      {latestVersion && ` • Version ${latestVersion.version}`}
                    </p>
                  </div>
                </div>

                {latestVersion?.sha256 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Empreinte SHA-256
                    </span>
                    <p className="text-[10px] font-mono text-slate-600 bg-slate-100/70 px-2 py-1 rounded truncate border border-slate-200/50 select-all" title={latestVersion.sha256}>
                      {latestVersion.sha256}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-2">
                  <FileText size={20} />
                </div>
                <p className="text-xs font-semibold text-slate-700">Aucun document attaché</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px] mx-auto">
                  Un document PDF doit être rattaché pour pouvoir envoyer ce contrat.
                </p>
              </div>
            )}
          </Card>

          {/* Metadata Card */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">
              Métadonnées du Contrat
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-400" /> Source
                </span>
                <span className="font-medium text-slate-800">{contract.source}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <FileCheck size={14} className="text-slate-400" /> Versions
                </span>
                <span className="font-medium text-slate-800">{contract._count?.versions ?? (contract.versions?.length || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-slate-400" /> Signatures
                </span>
                <span className="font-medium text-slate-800">{contract._count?.signatures ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" /> Création
                </span>
                <span className="font-medium text-slate-800">
                  {format(new Date(contract.createdAt), "dd MMM yyyy")}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Send Confirmation Modal (AXS-017) */}
      <SendConfirmModal
        isOpen={isSendConfirmOpen}
        onClose={() => {
          setIsSendConfirmOpen(false);
          setSendError(null);
        }}
        onConfirm={handleConfirmSend}
        contractTitle={contract.title}
        documentName={documentInfo?.name}
        documentSize={documentInfo?.size}
        participants={sortedParticipants}
        isLoading={sendContract.isPending}
        errorMessage={sendError}
      />

      {/* Participant Modal (Add & Edit) */}
      <ParticipantModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingParticipant(null);
        }}
        contractId={contract.id}
        participantToEdit={editingParticipant}
        defaultOrder={sortedParticipants.length + 1}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal border border-slate-100 animate-slide-in">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-center text-slate-900">
              Supprimer le signataire ?
            </h3>
            <p className="text-xs text-center text-slate-500 mt-1.5">
              Ce participant sera retiré du circuit de signature de ce contrat.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteParticipant.isPending}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Confirmer la suppression
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
