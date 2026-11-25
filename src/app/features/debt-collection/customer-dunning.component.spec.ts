import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  DebtCollectionApiService,
  PermissionsService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { CustomerDunningComponent } from './customer-dunning.component';
import { history, lookups, proposalItem, translateSpy, wrap } from './debt-collection.testing';

const messageSpy = { success: vi.fn(), error: vi.fn() };

interface CustomerInternals {
  openFlag(type: 'dispute' | 'legal_hold'): void;
  flag(payload: {
    customer_id: string;
    type: 'dispute' | 'legal_hold' | 'manual';
    reason: string;
  }): Promise<void>;
}

describe('CustomerDunningComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getCustomerHistory: vi.fn(() => of(wrap(history()))),
      listProposals: vi.fn(() => of(wrap({ items: [proposalItem('r-1')], groups: [] }))),
      createExclusion: vi.fn(() => of(wrap({}))),
      releaseExclusion: vi.fn(() => of(wrap({}))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DebtCollectionApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: { list: vi.fn(() => of({ data: [] })), get: vi.fn() },
        },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(CustomerDunningComponent);
    fixture.componentRef.setInput('customerId', 'c-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads the dunning history of the customer and shows summary, timeline, notices and receipts', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(api['getCustomerHistory']).toHaveBeenCalledWith('c-1');
    expect(text).toContain('debtCollection.customer.openOverdue');
    expect(text).toContain('debtCollection.level.2');
    expect(text).toContain('debtCollection.event.notice_sent');
    expect(text).toContain('SOL-n-1');
    expect(text).toContain('debtCollection.receiptKind.consegna');
    expect(text).toContain('Goods damaged');
  });

  it('offers the dispute, legal hold and payment plan controls to a member who can write', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('debtCollection.action.flagDispute');
    expect(text).toContain('debtCollection.action.flagLegalHold');
    expect(text).toContain('debtCollection.action.newPlan');
    expect(text).toContain('debtCollection.action.release');
  });

  it('shows the history read-only to a member who cannot write', async () => {
    canWrite = false;
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).not.toContain('debtCollection.action.flagDispute');
    expect(text).not.toContain('debtCollection.action.release');
    expect(text).toContain('SOL-n-1');
  });

  it('flags a dispute on the customer and reloads the history', async () => {
    const fixture = await render();
    const component = fixture.componentInstance as unknown as CustomerInternals;

    component.openFlag('dispute');
    await component.flag({ customer_id: 'c-1', type: 'dispute', reason: 'Goods damaged' });

    expect(api['createExclusion']).toHaveBeenCalledWith({
      customer_id: 'c-1',
      type: 'dispute',
      reason: 'Goods damaged',
    });
    expect(api['getCustomerHistory']).toHaveBeenCalledTimes(2);
    expect(messageSpy.success).toHaveBeenCalledWith('debtCollection.msg.exclusionCreated');
  });
});
