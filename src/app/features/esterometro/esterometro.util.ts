import {
  DeadlineUrgency,
  EsterometroSdiStatus,
  SelfInvoiceDocumentType,
  SelfInvoiceStatus,
} from '../../core/models/esterometro.model';

export const SELF_INVOICE_DOC_TYPES: SelfInvoiceDocumentType[] = [
  'TD16',
  'TD17',
  'TD18',
  'TD19',
  'TD20',
  'TD28',
];

export function statusColor(status: SelfInvoiceStatus | EsterometroSdiStatus): string {
  switch (status) {
    case 'DELIVERED_RC':
      return 'success';
    case 'SENT_TO_SDI':
    case 'PENDING_SEND':
      return 'processing';
    case 'VALIDATED':
      return 'cyan';
    case 'REJECTED_NS':
    case 'FAILED_TRANSMISSION':
      return 'error';
    case 'CANCELLED':
      return 'default';
    default:
      return 'warning';
  }
}

export function urgencyColor(urgency: DeadlineUrgency): string {
  switch (urgency) {
    case 'OVERDUE':
      return 'error';
    case 'DUE_SOON':
      return 'warning';
    case 'TRANSMITTED':
      return 'success';
    default:
      return 'blue';
  }
}

export function docTypeColor(docType: SelfInvoiceDocumentType): string {
  switch (docType) {
    case 'TD16':
      return 'purple';
    case 'TD17':
      return 'blue';
    case 'TD18':
      return 'geekblue';
    case 'TD19':
      return 'cyan';
    case 'TD20':
      return 'orange';
    case 'TD28':
      return 'gold';
  }
}
