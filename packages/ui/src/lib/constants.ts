export const CONTRACT_STATUS_STYLES: Record<string, string> = {
  DRAFT:       'bg-slate-100 text-slate-700 ring-slate-200/60',
  SENT:        'bg-blue-50  text-blue-700  ring-blue-200/60',
  VIEWED:      'bg-amber-50 text-amber-700 ring-amber-200/60',
  IN_PROGRESS: 'bg-orange-50 text-orange-700 ring-orange-200/60',
  COMPLETED:   'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
  DECLINED:    'bg-red-50   text-red-700   ring-red-200/60',
  EXPIRED:     'bg-slate-100 text-slate-500 ring-slate-200/60',
  CANCELLED:   'bg-slate-100 text-slate-500 ring-slate-200/60',
};

export const PARTICIPANT_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  SENT:    'bg-blue-50 text-blue-700',
  VIEWED:  'bg-amber-50 text-amber-700',
  SIGNED:  'bg-emerald-50 text-emerald-700',
  DECLINED:'bg-red-50 text-red-700',
};
