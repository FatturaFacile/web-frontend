import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { QrBill } from '@domain/models/qr-bill.model';
import { QR_BILL_REPOSITORY, QrBillRepository } from '@domain/repositories/qr-bill.repository';
import { QrBillStore } from './qr-bill.store';

describe('QrBillStore', () => {
  let store: InstanceType<typeof QrBillStore>;
  let mockRepository: {
    getBills: ReturnType<typeof vi.fn>;
    createBill: ReturnType<typeof vi.fn>;
  };

  const mockBills: QrBill[] = [
    {
      id: 'qrb-1',
      billNumber: 'QR-001',
      issueDate: '2026-10-01',
      dueDate: '2026-11-01',
      currency: 'CHF',
      amount: 1000.05,
      creditor: { name: 'Creditor SA', address: 'Via A', postalCode: '6900', city: 'Lugano', country: 'CH', qrIban: 'CH44...' },
      debtor: { name: 'Debtor SA', address: 'Via B', postalCode: '6900', city: 'Lugano', country: 'CH' },
      reference: '210000000001',
      unstructuredMessage: 'Test 1',
      status: 'PAID',
    },
    {
      id: 'qrb-2',
      billNumber: 'QR-002',
      issueDate: '2026-10-02',
      dueDate: '2026-11-02',
      currency: 'CHF',
      amount: 500.1,
      creditor: { name: 'Creditor SA', address: 'Via A', postalCode: '6900', city: 'Lugano', country: 'CH', qrIban: 'CH44...' },
      debtor: { name: 'Debtor 2 SA', address: 'Via C', postalCode: '6900', city: 'Lugano', country: 'CH' },
      reference: '210000000002',
      unstructuredMessage: 'Test 2',
      status: 'PENDING',
    },
  ];

  beforeEach(() => {
    mockRepository = {
      getBills: vi.fn().mockReturnValue(of(mockBills)),
      createBill: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        QrBillStore,
        { provide: QR_BILL_REPOSITORY, useValue: mockRepository as unknown as QrBillRepository },
      ],
    });

    store = TestBed.inject(QrBillStore);
  });

  it('should initialize with empty state and load bills via repository', () => {
    expect(store.bills()).toEqual([]);
    expect(store.billsCount()).toBe(0);

    store.loadBills();

    expect(mockRepository.getBills).toHaveBeenCalledTimes(1);
    expect(store.bills().length).toBe(2);
    expect(store.billsCount()).toBe(2);
    expect(store.totalChfRevenue()).toBe(1500.15);
    expect(store.pendingBillsCount()).toBe(1);
    expect(store.currentBill()?.id).toBe('qrb-1');
  });

  it('should add a new bill and set it as selected', () => {
    store.loadBills();

    const newBill: QrBill = {
      id: 'qrb-3',
      billNumber: 'QR-003',
      issueDate: '2026-10-20',
      dueDate: '2026-11-20',
      currency: 'CHF',
      amount: 250.0,
      creditor: { name: 'Creditor SA', address: 'Via A', postalCode: '6900', city: 'Lugano', country: 'CH' },
      debtor: { name: 'New Debtor', address: 'Via D', postalCode: '6900', city: 'Lugano', country: 'CH' },
      reference: '210000000003',
      unstructuredMessage: 'New Invoice',
      status: 'PENDING',
    };

    store.addBill(newBill);

    expect(store.bills().length).toBe(3);
    expect(store.currentBill()?.id).toBe('qrb-3');
    expect(store.pendingBillsCount()).toBe(2);
  });
});
