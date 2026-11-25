/** FatturaPA document types a supplier invoice can carry (`TipoDocumento`), each with a seeded label. */
export const KNOWN_DOCUMENT_TYPES: readonly string[] = [
  'TD01',
  'TD02',
  'TD04',
  'TD05',
  'TD06',
  'TD16',
  'TD17',
  'TD18',
  'TD19',
  'TD20',
  'TD24',
  'TD25',
];

export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid'] as const;

export const APPROVAL_STATUSES = [
  'not_required',
  'pending',
  'in_approval',
  'approved',
  'rejected',
  'match_blocked',
] as const;

/** Translation key of a document type; documents without a known type show the generic invoice label. */
export function invoiceDocumentTypeKey(code: string | null | undefined): string {
  return code && KNOWN_DOCUMENT_TYPES.includes(code)
    ? `srm.invoice.documentType.${code}`
    : 'srm.invoice.documentType.TD01';
}

/** Credit notes (TD04) reduce the payable; they are flagged in the header. */
export function isCreditNote(code: string | null | undefined): boolean {
  return code === 'TD04';
}

export function paymentStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'paid':
      return 'green';
    case 'partially_paid':
      return 'orange';
    default:
      return 'default';
  }
}

export function approvalStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'approved':
    case 'not_required':
      return 'green';
    case 'rejected':
    case 'match_blocked':
      return 'red';
    case 'pending':
    case 'in_approval':
      return 'orange';
    default:
      return 'default';
  }
}
