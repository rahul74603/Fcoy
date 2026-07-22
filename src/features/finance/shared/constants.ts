export const BILL_STATUS_CONFIG: Record<
  string,
  { cls: string; dot: string }
> = {
  Pending:   { cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  Received:  { cls: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'  },
  Verified:  { cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  'No Bill': { cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};