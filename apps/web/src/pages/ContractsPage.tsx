import { useState } from "react";
import { Link } from "react-router-dom";
import { useContracts } from "@/hooks/use-contracts";
import { CreateContractModal } from "@/components/contracts/CreateContractModal";
import {
  Button,
  Input,
  StatusBadge,
  Card,
  TableSkeleton,
  EmptyState,
  PageHeader,
} from "@axa-sign/ui";
import {
  Plus,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_FILTERS = [
  { label: "All", value: undefined },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Declined", value: "DECLINED" },
];

export function ContractsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useContracts({ page, status: statusFilter });

  const filteredContracts = data?.data.filter((contract) => {
    if (!searchQuery) return true;
    return contract.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Contracts & Agreements"
        description="Create, send, track and manage electronic signatures in real-time."
        action={
          <Button
            onClick={() => setShowCreate(true)}
            leftIcon={<Plus size={16} />}
            variant="primary"
          >
            New Contract
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.value;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  setStatusFilter(f.value);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={15} />}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Contract List Table */}
      <Card padding="none" className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !filteredContracts || filteredContracts.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="No contracts found"
            description={
              statusFilter || searchQuery
                ? "Try clearing your filters or search term to see more contracts."
                : "Create your first electronic contract to begin collecting legal signatures."
            }
            action={
              <Button
                variant="primary"
                onClick={() => setShowCreate(true)}
                leftIcon={<Plus size={16} />}
              >
                Create Contract
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-6 py-3.5">Contract Title</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5">Participants</th>
                  <th scope="col" className="px-6 py-3.5">Created Date</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredContracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-600 transition-colors flex items-center gap-2"
                      >
                        <FileText size={16} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                        {contract.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users size={14} className="text-slate-400" />
                        <span>{contract.participants.length} signer{contract.participants.length !== 1 ? "s" : ""}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{format(new Date(contract.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 text-xs text-slate-500">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {(data.pagination.page - 1) * data.pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-700">
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{data.pagination.total}</span> contracts
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                leftIcon={<ChevronLeft size={14} />}
              >
                Previous
              </Button>
              <span className="px-2 font-medium text-slate-700">
                {page} / {data.pagination.pages}
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                disabled={page === data.pagination.pages}
                rightIcon={<ChevronRight size={14} />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Accessible Create Contract Modal with Drag & Drop PDF Upload (AXS-015) */}
      <CreateContractModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
