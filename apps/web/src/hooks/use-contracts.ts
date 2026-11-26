import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ParticipantType = "SIGNER" | "APPROVER" | "CC" | "VIEWER";

export interface Participant {
  id: string;
  name: string;
  email: string;
  type?: ParticipantType;
  role?: string | null;
  signingOrder?: number;
  status: string;
  signedAt?: string | null;
  declinedAt?: string | null;
}

export interface DocumentInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256?: string;
  pageCount?: number;
}

export interface ContractVersion {
  id: string;
  version: number;
  sha256: string;
  createdAt: string;
  documentId: string;
  document?: DocumentInfo;
}

export interface Contract {
  id: string;
  title: string;
  status: string;
  source: string;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
  participants: Participant[];
  versions?: ContractVersion[];
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

export function useUploadDocument() {
  return useMutation({
    mutationFn: ({
      file,
      contractId,
      onProgress,
    }: {
      file: File;
      contractId?: string;
      onProgress?: (percent: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (contractId) {
        formData.append("contractId", contractId);
      }
      return api.upload<{ id: string; name: string; size: number }>(
        "/documents",
        formData,
        onProgress
      );
    },
  });
}

export interface AddParticipantInput {
  contractId: string;
  name: string;
  email: string;
  type: ParticipantType;
  role?: string;
  signingOrder?: number;
}

export function useAddParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, ...data }: AddParticipantInput) =>
      api.post<Participant>(`/contracts/${contractId}/participants`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract", variables.contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useUpdateParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      contractId: _contractId,
      data,
    }: {
      id: string;
      contractId: string;
      data: Partial<Omit<AddParticipantInput, "contractId">>;
    }) => api.patch<Participant>(`/participants/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract", variables.contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useDeleteParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, contractId: _contractId }: { id: string; contractId: string }) =>
      api.delete(`/participants/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract", variables.contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
