import { useState } from "react";
import { Link } from "react-router-dom";
import { useContracts, useCreateContract } from "@/hooks/use-contracts";
import { cn } from "@/lib/cn";
import { Plus, FileText } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export function ContractsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data, isLoading } = useContracts({ page, status: statusFilter });
  const createContract = useCreateContract();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createContract.mutateAsync({ title: newTitle });
    setNewTitle("");
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your signing contracts
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} />
          New Contract
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Contract</h3>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Contract title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createContract.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  {createContract.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter || ""}
          onChange={(e) => setStatusFilter(e.target.value || undefined)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="DECLINED">Declined</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">No contracts yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first contract to get started
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Participants
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.data.map((contract) => (
                <tr
                  key={contract.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      to={`/contracts/${contract.id}`}
                      className="font-medium text-gray-900 hover:text-brand-500"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_STYLES[contract.status] || "bg-gray-100 text-gray-700"
                      )}
                    >
                      {contract.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {contract.participants.length}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(contract.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to{" "}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{" "}
            {data.pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
              disabled={page === data.pagination.pages}
              className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
