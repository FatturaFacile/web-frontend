/** Tag colours of the sales cycle statuses (ng-zorro preset colours). */
const STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  sent: 'blue',
  accepted: 'green',
  confirmed: 'green',
  approved: 'green',
  received: 'green',
  credited: 'green',
  completed: 'green',
  delivered: 'green',
  issued: 'blue',
  dispatched: 'blue',
  requested: 'gold',
  on_hold: 'orange',
  in_production: 'processing',
  shipped: 'cyan',
  invoiced: 'purple',
  converted: 'purple',
  superseded: 'default',
  expired: 'volcano',
  rejected: 'red',
  cancelled: 'red',
  reserved: 'green',
  partially_reserved: 'gold',
  not_reserved: 'default',
  not_required: 'default',
  released: 'default',
};

export function statusColor(status: string | null | undefined): string {
  return STATUS_COLORS[status ?? ''] ?? 'default';
}

/** i18n key of a status label, e.g. `SC.STATUS.on_hold`. */
export function statusKey(status: string | null | undefined): string {
  return `SC.STATUS.${status ?? 'unknown'}`;
}

/** Today as `YYYY-MM-DD` (local date). */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The ISO date `days` after today. */
export function inDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
