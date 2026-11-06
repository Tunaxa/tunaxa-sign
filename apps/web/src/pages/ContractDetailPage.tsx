import { useParams, Link } from "react-router-dom";
import { useContract, useSendContract, useCancelContract } from "@/hooks/use-contracts";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import { ArrowLeft, Send, XCircle, CheckCircle } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
};

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isLoading } = useContract(id!);
  const sendContract = useSendContract();
  const cancelContract = useCancelContract();

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!contract) {
    return <div className="text-center py-12 text-gray-500">Contract not found</div>;
  }

  return (
    <div>
      <Link
        to="/contracts"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={16} />
        Back to contracts
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created by {contract.creator.firstName} {contract.creator.lastName} on{" "}
            {format(new Date(contract.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
              STATUS_STYLES[contract.status] || "bg-gray-100 text-gray-700"
            )}
          >
            {contract.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Actions */}
      {contract.status === "DRAFT" && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => sendContract.mutate(contract.id)}
            disabled={sendContract.isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
            Send for Signature
          </button>
          <button
            onClick={() => cancelContract.mutate(contract.id)}
            disabled={cancelContract.isPending}
            className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <XCircle size={16} />
            Cancel
          </button>
        </div>
      )}

      {/* Participants */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Participants</h2>
        {contract.participants.length === 0 ? (
          <p className="text-sm text-gray-500">No participants added yet</p>
        ) : (
          <div className="space-y-3">
            {contract.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
              >
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.email}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    p.status === "SIGNED"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {p.status === "SIGNED" && <CheckCircle size={12} className="mr-1" />}
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Trail */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>
        <div className="text-sm text-gray-500">
          Audit events will appear here as the contract progresses.
        </div>
      </div>
    </div>
  );
}
