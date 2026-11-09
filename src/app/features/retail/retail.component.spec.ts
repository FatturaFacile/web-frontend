import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  CommercialDocumentResource,
  DailyCorrispettivoResource,
  LoyaltyApiService,
  LoyaltyCard,
  LoyaltyTransaction,
  RetailApiService,
} from '@core';
import { RetailComponent } from './retail.component';

describe('RetailComponent', () => {
  let component: RetailComponent;
  let fixture: ComponentFixture<RetailComponent>;
  let apiService: Partial<RetailApiService>;
  let loyaltyApiService: Partial<LoyaltyApiService>;
  let messageService: Partial<NzMessageService>;

  const mockDoc: CommercialDocumentResource = {
    id: 'doc-1',
    document_number: 'DOC-001',
    issued_at: '2026-04-10T12:00:00Z',
    payment_method: 'card',
    total_amount: 50,
    status: 'issued',
  };

  const mockDaily: DailyCorrispettivoResource = {
    date: '2026-04-10',
    device_serial: 'RT-001',
    total_sales: 1500,
    total_vat: 330,
    transactions_count: 35,
    status: 'transmitted',
  };

  const mockCard: LoyaltyCard = {
    id: 'card-1',
    customer_id: 'cust-101',
    customer_name: 'Mario Rossi',
    card_number: 'LOY-123456',
    balance: 200,
    status: 'active',
    created_at: '2026-04-01T10:00:00Z',
  };

  const mockTx: LoyaltyTransaction = {
    id: 'tx-1',
    loyalty_card_id: 'card-1',
    type: 'topup',
    amount: 50,
    description: 'Bonus acquisto',
    created_at: '2026-04-05T14:00:00Z',
  };

  beforeEach(async () => {
    apiService = {
      getCommercialDocuments: vi.fn().mockReturnValue(of({ data: [mockDoc], meta: { total: 1 } })),
      createCommercialDocument: vi.fn().mockReturnValue(of({ data: mockDoc })),
      voidCommercialDocument: vi.fn().mockReturnValue(of({ data: { ...mockDoc, status: 'voided' } })),
      getDailyCorrispettivi: vi.fn().mockReturnValue(of({ data: mockDaily })),
    };

    loyaltyApiService = {
      getCards: vi.fn().mockReturnValue(of({ data: [mockCard], meta: { total: 1 } })),
      createCard: vi.fn().mockReturnValue(of({ data: mockCard })),
      updateCard: vi.fn().mockReturnValue(of({ data: { ...mockCard, status: 'suspended' } })),
      deleteCard: vi.fn().mockReturnValue(of({ success: true })),
      getTransactions: vi.fn().mockReturnValue(of({ data: [mockTx] })),
      recordTransaction: vi.fn().mockReturnValue(of({ data: mockTx })),
    };

    messageService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: RetailApiService, useValue: apiService },
        { provide: LoyaltyApiService, useValue: loyaltyApiService },
        { provide: NzMessageService, useValue: messageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RetailComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      if (config.nzOnOk) config.nzOnOk();
      return {} as NzModalRef;
    });
    fixture.detectChanges();
  });

  it('initializes and loads commercial documents, daily corrispettivi, and loyalty cards', () => {
    expect(component).toBeTruthy();
    expect(component.documents().length).toBe(1);
    expect(component.dailyCorrispettivo()).toEqual(mockDaily);
    expect(component.loyaltyCards().length).toBe(1);
    expect(component.kpiTotalDocs()).toBe(1);
    expect(component.kpiIssuedDocs()).toBe(1);
    expect(component.kpiActiveCards()).toBe(1);
  });

  it('submits a new commercial document', () => {
    component.openCreateModal();
    expect(component.isCreateModalVisible()).toBe(true);

    component.docForm.patchValue({
      payment_method: 'electronic',
      cashier_name: 'Cassa 2',
    });
    component.linesArray.at(0).patchValue({
      description: 'Caffè e Cornetto',
      quantity: 2,
      unit_price: 2.5,
      vat_rate: 10,
    });

    component.submitDocument();
    expect(apiService.createCommercialDocument).toHaveBeenCalled();
    expect(component.isCreateModalVisible()).toBe(false);
  });

  it('voids an issued commercial document', () => {
    component.voidDocument(mockDoc);
    expect(apiService.voidCommercialDocument).toHaveBeenCalledWith('doc-1');
  });

  it('opens issue card modal and submits a new loyalty card', () => {
    component.openIssueCardModal();
    expect(component.isIssueCardModalVisible()).toBe(true);

    component.issueCardForm.patchValue({
      customer_id: 'cust-202',
      card_number: 'LOY-999999',
      initial_balance: 100,
    });

    component.submitIssueCard();
    expect(loyaltyApiService.createCard).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'cust-202',
        card_number: 'LOY-999999',
        initial_balance: 100,
      })
    );
    expect(component.isIssueCardModalVisible()).toBe(false);
  });

  it('opens loyalty drawer and loads transaction history', () => {
    component.openLoyaltyDrawer(mockCard);
    expect(component.isLoyaltyDrawerVisible()).toBe(true);
    expect(component.selectedLoyaltyCard()).toEqual(mockCard);
    expect(loyaltyApiService.getTransactions).toHaveBeenCalledWith('card-1');
    expect(component.loyaltyTransactions().length).toBe(1);

    component.closeLoyaltyDrawer();
    expect(component.isLoyaltyDrawerVisible()).toBe(false);
    expect(component.selectedLoyaltyCard()).toBeNull();
  });

  it('records a point topup or spend transaction', () => {
    component.openRecordTxModal(mockCard);
    expect(component.isRecordTxModalVisible()).toBe(true);

    component.recordTxForm.patchValue({
      type: 'spend',
      amount: 30,
      description: 'Sconto cassa',
    });

    component.submitRecordTx();
    expect(loyaltyApiService.recordTransaction).toHaveBeenCalledWith(
      'card-1',
      expect.objectContaining({
        type: 'spend',
        amount: 30,
        description: 'Sconto cassa',
      })
    );
    expect(component.isRecordTxModalVisible()).toBe(false);
  });

  it('toggles card status and deletes loyalty card', () => {
    component.toggleCardStatus(mockCard);
    expect(loyaltyApiService.updateCard).toHaveBeenCalledWith('card-1', { status: 'suspended' });

    component.deleteLoyaltyCard(mockCard);
    expect(loyaltyApiService.deleteCard).toHaveBeenCalledWith('card-1');
  });
});
