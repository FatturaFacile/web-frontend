import { describe, expect, it } from 'vitest';
import { QrBillDto } from '../dtos/qr-bill.dto';
import { QrBillMapper } from './qr-bill.mapper';

describe('QrBillMapper', () => {
  const sampleDto: QrBillDto = {
    id: 'qrb-001',
    billNumber: 'QR-2026-0042',
    issueDate: '2026-10-15',
    dueDate: '2026-11-15',
    currency: 'CHF',
    amount: 1450.83,
    creditor: {
      name: 'Helvetia Tech SA',
      address: 'Via Nassa 12',
      postalCode: '6900',
      city: 'Lugano',
      country: 'CH',
      qrIban: 'CH4431999123000889012',
    },
    debtor: {
      name: 'Bernasconi SA',
      address: 'Corso Elvezia 18',
      postalCode: '6900',
      city: 'Lugano',
      country: 'CH',
    },
    reference: '210000000003139471430009017',
    unstructuredMessage: 'Fattura consulenza',
    status: 'PENDING',
  };

  it('should round Swiss CHF amounts to the nearest 0.05 centime correctly', () => {
    expect(QrBillMapper.roundSwissAmount(10.02)).toBe(10.0);
    expect(QrBillMapper.roundSwissAmount(10.03)).toBe(10.05);
    expect(QrBillMapper.roundSwissAmount(10.07)).toBe(10.05);
    expect(QrBillMapper.roundSwissAmount(10.08)).toBe(10.1);
    expect(QrBillMapper.roundSwissAmount(1450.83)).toBe(1450.85);
  });

  it('should map QrBillDto to QrBill domain model applying Swiss rounding to CHF', () => {
    const domain = QrBillMapper.toDomain(sampleDto);

    expect(domain.id).toBe('qrb-001');
    expect(domain.billNumber).toBe('QR-2026-0042');
    expect(domain.amount).toBe(1450.85); // 1450.83 rounded to nearest 0.05
    expect(domain.currency).toBe('CHF');
    expect(domain.creditor.qrIban).toBe('CH4431999123000889012');
  });

  it('should map QrBill domain model to QrBillDto cleanly', () => {
    const domain = QrBillMapper.toDomain(sampleDto);
    const dto = QrBillMapper.toDto(domain);

    expect(dto.id).toBe('qrb-001');
    expect(dto.amount).toBe(1450.85);
    expect(dto.debtor.name).toBe('Bernasconi SA');
  });
});
