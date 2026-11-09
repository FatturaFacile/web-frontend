import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, PaymentProposal, PermissionsService, TreasuryApiService, TreasuryOpsApiService } from '@core';
import { TrPaymentProposalsComponent } from './tr-payment-proposals.component';

function proposal(createdBy: string): PaymentProposal {
  return {
    id: 'p1',
    proposal_number: 'PP-1',
    status: 'draft',
    bank_account_id: 'ba1',
    format: 'sepa_pain_001_it',
    execution_date: '2026-11-30',
    due_until: '2026-11-30',
    include_discounts: false,
    currency: 'EUR',
    total_amount: '100.00',
    total_discount: '0.00',
    item_count: 1,
    created_by: createdBy,
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    payment_batch_id: null,
  };
}

describe('TrPaymentProposalsComponent', () => {
  const api = {
    getPaymentProposals: vi.fn(),
    createPaymentProposal: vi.fn(),
    approvePaymentProposal: vi.fn(),
    rejectPaymentProposal: vi.fn(),
  };

  async function create(createdBy: string) {
    TestBed.resetTestingModule();
    api.getPaymentProposals.mockReturnValue(of({ success: true, message: '', data: [proposal(createdBy)] }));
    await TestBed.configureTestingModule({
      imports: [TrPaymentProposalsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TreasuryOpsApiService, useValue: api },
        { provide: TreasuryApiService, useValue: { getBankAccounts: () => of({ data: [] }), downloadPaymentBatchXml: vi.fn() } },
        { provide: AuthStore, useValue: { user: () => ({ id: 'me' }) } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TrPaymentProposalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.approvePaymentProposal.mockReturnValue(of({ success: true, message: '', data: proposal('other') }));
  });

  function actionLabels(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('tbody button')).map((b) => (b.textContent ?? '').trim());
  }

  it('offers the approval to somebody other than the author', async () => {
    const fixture = await create('someone-else');
    expect(api.getPaymentProposals).toHaveBeenCalledWith('draft');
    expect(actionLabels(fixture.nativeElement)).toHaveLength(2);
    (fixture.componentInstance as unknown as { approve(p: PaymentProposal): void }).approve(proposal('someone-else'));
    expect(api.approvePaymentProposal).toHaveBeenCalledWith('p1');
  });

  it('hides the approval from the author, leaving only the rejection', async () => {
    const fixture = await create('me');
    expect(actionLabels(fixture.nativeElement)).toHaveLength(1);
  });
});
