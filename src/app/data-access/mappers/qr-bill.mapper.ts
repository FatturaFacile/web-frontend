import { QrBill } from '@domain/models/qr-bill.model';
import { QrBillDto } from '../dtos/qr-bill.dto';

export class QrBillMapper {
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
