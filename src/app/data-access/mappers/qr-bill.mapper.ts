import { QrBill } from '@domain/models/qr-bill.model';
import { QrBillDto } from '../dtos/qr-bill.dto';
import { SalesInvoiceApiDto } from '../dtos/sales-invoice.dto';

export class QrBillMapper {
  /**
   * Maps an invoice of the API that carries Swiss QR-bill data. The creditor address is not part of the
   * invoice list, only the QR-IBAN and the SCOR reference are; amounts are converted for display only.
   */
  static fromInvoice(dto: SalesInvoiceApiDto): QrBill {
    const status: QrBill['status'] =
      dto.status === 'cancelled' || dto.status === 'voided'
        ? 'CANCELLED'
        : dto.payment_status === 'paid'
          ? 'PAID'
          : dto.status === 'draft'
            ? 'DRAFT'
            : 'PENDING';
    return {
      id: dto.id,
      billNumber: dto.invoice_number,
      issueDate: dto.date,
      dueDate: dto.due_date ?? dto.date,
      currency: dto.currency === 'EUR' ? 'EUR' : 'CHF',
      amount: Number(dto.amount_due),
      creditor: { name: '', address: '', postalCode: '', city: '', country: 'CH', qrIban: dto.qr_bill_data?.qr_iban },
      debtor: {
        name: dto.contact?.name ?? '',
        address: '',
        postalCode: '',
        city: '',
        country: dto.contact?.country ?? 'CH',
      },
      reference: dto.qr_bill_data?.scor_reference ?? '',
      unstructuredMessage: dto.notes ?? '',
      status,
    };
  }

  /**
   * Applies Swiss 0.05 CHF cash/commercial rounding logic.
   */
  static roundSwissAmount(amount: number): number {
    return Math.round(amount * 20) / 20;
  }

  static toDomain(dto: QrBillDto): QrBill {
    return {
      id: dto.id,
      billNumber: dto.billNumber,
      issueDate: dto.issueDate,
      dueDate: dto.dueDate,
      currency: dto.currency,
      amount: dto.currency === 'CHF' ? this.roundSwissAmount(dto.amount) : dto.amount,
      creditor: { ...dto.creditor },
      debtor: { ...dto.debtor },
      reference: dto.reference,
      unstructuredMessage: dto.unstructuredMessage,
      status: dto.status,
    };
  }

  static toDto(model: QrBill): QrBillDto {
    return {
      id: model.id,
      billNumber: model.billNumber,
      issueDate: model.issueDate,
      dueDate: model.dueDate,
      currency: model.currency,
      amount: model.amount,
      creditor: { ...model.creditor },
      debtor: { ...model.debtor },
      reference: model.reference,
      unstructuredMessage: model.unstructuredMessage,
      status: model.status,
    };
  }
}
