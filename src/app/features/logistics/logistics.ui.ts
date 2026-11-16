import { DeliveryNoteStatus, DeliveryNoteType, DiscrepancyStatus, TransferStatus } from '@core';

export const DDT_STATUS_COLOR: Record<DeliveryNoteStatus, string> = {
  draft: 'default',
  issued: 'blue',
  in_transit: 'processing',
  delivered: 'success',
  partially_invoiced: 'orange',
  invoiced: 'green',
  cancelled: 'error',
};

export const TRANSFER_STATUS_COLOR: Record<TransferStatus, string> = {
  draft: 'default',
  in_transit: 'processing',
  received: 'success',
  discrepancy_pending: 'warning',
  reconciled: 'green',
  cancelled: 'error',
};

export const DISCREPANCY_COLOR: Record<DiscrepancyStatus, string> = {
  pending_approval: 'warning',
  approved_write_off: 'default',
  carrier_claim: 'purple',
  returned_to_origin: 'blue',
};

/** i18n key helpers: the dictionaries come from the API (LogisticsFrontendTranslations seeder). */
export const ddtStatusKey = (s: DeliveryNoteStatus): string =>
  `LOGISTICS.DDT.STATUS.${s.toUpperCase()}`;
export const ddtTypeKey = (t: DeliveryNoteType): string => `LOGISTICS.DDT.TYPE.${t.toUpperCase()}`;
export const reasonKey = (r: string): string => `LOGISTICS.REASON.${r.toUpperCase()}`;
export const carriageKey = (c: string): string => `LOGISTICS.CARRIAGE.${c.toUpperCase()}`;
export const transportByKey = (c: string): string => `LOGISTICS.TRANSPORT_BY.${c.toUpperCase()}`;
export const transferStatusKey = (s: TransferStatus): string =>
  `LOGISTICS.TRANSFER.STATUS.${s.toUpperCase()}`;
export const transferPurposeKey = (p: string): string =>
  `LOGISTICS.TRANSFER.PURPOSE.${p.toUpperCase()}`;
export const discrepancyKey = (s: DiscrepancyStatus): string =>
  `LOGISTICS.DISCREPANCY.STATUS.${s.toUpperCase()}`;
export const warehouseTypeKey = (t: string): string =>
  `LOGISTICS.WAREHOUSE.TYPE.${t.toUpperCase()}`;

/** Triggers a browser download for a blob (PDF). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Statuses that can still be billed with a deferred invoice (mirrors DeliveryNoteStatus::invoiceable()). */
export const INVOICEABLE: readonly DeliveryNoteStatus[] = [
  'issued',
  'in_transit',
  'delivered',
  'partially_invoiced',
];
