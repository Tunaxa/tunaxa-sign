// Shared contract & participant status styles for the web app.
// Single source of truth — eliminates duplication between ContractsPage and ContractDetailPage.
export const CONTRACT_STATUS_STYLES: Record<string, string> = {
  DRAFT:       'bg-gray-100 text-gray-700',
  SENT:        'bg-blue-100 text-blue-700',
  VIEWED:      'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED:   'bg-green-100 text-green-700',
  DECLINED:    'bg-red-100 text-red-700',
  EXPIRED:     'bg-gray-100 text-gray-500',
  CANCELLED:   'bg-gray-100 text-gray-500',
};

export const PARTICIPANT_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  SENT:    'bg-blue-100 text-blue-700',
  VIEWED:  'bg-yellow-100 text-yellow-700',
  SIGNED:  'bg-green-100 text-green-700',
  DECLINED:'bg-red-100 text-red-700',
};
