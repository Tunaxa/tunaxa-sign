import { useParams, Link } from "react-router-dom";
import { useContract, useSendContract, useCancelContract } from "@/hooks/use-contracts";
import { Button, StatusBadge, Card } from "@axa-sign/ui";
import { format } from "date-fns";
import {
  ArrowLeft,
  Send,
  XCircle,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  FileCheck,
} from "lucide-react";

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isLoading } = useContract(id!);
  const sendContract = useSendContract();
  const cancelContract = useCancelContract();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-24 bg-white rounded-xl border border-slate-200" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-white rounded-xl border border-slate-200" />
          <div className="h-64 bg-white rounded-xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-slate-800">Contract not found</h2>
        <p className="text-sm text-slate-500 mt-1">
          The requested agreement does not exist or you do not have permission to view it.
        </p>
        <Link to="/contracts" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
          <ArrowLeft size={16} /> Back to contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/contracts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={15} /> Back to contracts list
        </Link>
      </div>

      {/* Main Contract Header Card */}
      <Card padding="lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {contract.title}
              </h1>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>Initiated by {contract.creator.firstName} {contract.creator.lastName}</span>
              <span>•</span>
              <span>{format(new Date(contract.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </p>
          </div>

          {/* Action buttons (only applicable in DRAFT state) */}
          {contract.status === "DRAFT" && (
            <div className="flex items-center gap-2.5">
              <Button
                variant="primary"
                onClick={() => sendContract.mutate(contract.id)}
                loading={sendContract.isPending}
                leftIcon={<Send size={15} />}
              >
                Send for Signature
              </Button>
              <Button
                variant="danger"
                onClick={() => cancelContract.mutate(contract.id)}
                loading={cancelContract.isPending}
                leftIcon={<XCircle size={15} />}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Participants & Audit Trail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Participants Card */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <User size={18} className="text-brand-600" />
                Signers & Participants
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {contract.participants.length} recipient{contract.participants.length !== 1 ? "s" : ""}
              </span>
            </div>

            {contract.participants.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No external participants assigned yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {contract.participants.map((p) => {
                  const isSigned = p.status === "SIGNED";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.email}</p>
                      </div>

                      <div className="flex items-center gap-2">
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
                Audit Trail & Event Log
              </h2>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                eIDAS Verified
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 text-xs">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium text-slate-900">Contract Draft Created</p>
                  <p className="text-slate-500 text-[11px]">
                    Created by {contract.creator.firstName} {contract.creator.lastName} ({contract.creator.email})
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
                    <p className="font-medium text-slate-900">Invitations Dispatched</p>
                    <p className="text-slate-500 text-[11px]">Signing tokens generated and queued for delivery</p>
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
                    <p className="font-medium text-slate-900">Contract Fully Executed</p>
                    <p className="text-slate-500 text-[11px]">Cryptographic completion certificate issued</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      {format(new Date(contract.completedAt), "PPpp")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Metadata Overview */}
        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">
              Contract Metadata
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
                <span className="font-medium text-slate-800">{contract._count.versions}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-slate-400" /> Signatures
                </span>
                <span className="font-medium text-slate-800">{contract._count.signatures}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" /> Created
                </span>
                <span className="font-medium text-slate-800">
                  {format(new Date(contract.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
