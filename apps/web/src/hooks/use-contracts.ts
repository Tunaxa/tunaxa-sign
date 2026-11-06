import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Contract {
  id: string;
  title: string;
  status: string;
  source: string;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
  participants: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
  }>;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count: {
    versions: number;
    signatures: number;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export function useContracts(params?: { page?: number; limit?: number; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);

  return useQuery<PaginatedResponse<Contract>>({
    queryKey: ["contracts", params],
    queryFn: () => api.get(`/contracts?${query.toString()}`),
  });
}

export function useContract(id: string) {
  return useQuery<Contract>({
    queryKey: ["contract", id],
    queryFn: () => api.get(`/contracts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; templateId?: string }) =>
      api.post<Contract>("/contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useSendContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractId: string) =>
      api.post<Contract>(`/contracts/${contractId}/send`),
    onSuccess: (_, contractId) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    },
  });
}

export function useCancelContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractId: string) =>
      api.post<Contract>(`/contracts/${contractId}/cancel`),
    onSuccess: (_, contractId) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    },
  });
}
