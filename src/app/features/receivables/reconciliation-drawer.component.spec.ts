import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { ReconciliationDrawerComponent } from './reconciliation-drawer.component';
import { item, payments } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('ReconciliationDrawerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<ReconciliationDrawerComponent>;
  const first = item('1', { open_amount: '300.00', value_date: '2026-03-12' });
  const second = item('2', { open_amount: '150.00' });

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getUnreconciledPayments: vi.fn(() => of({ data: payments })),
      allocate: vi.fn(() =>
        of({ data: { allocations: [], items: [item('1', { open_amount: '0.00', status: 'paid' })] } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ReceivablesApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  afterEach(() => fixture?.destroy());

  async function open(items = [first, second]): Promise<void> {
    fixture = TestBed.createComponent(ReconciliationDrawerComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('starts a full allocation per item and loads the unreconciled payments when opened', async () => {
    await open();

    const store = fixture.componentInstance.store;
    expect(store.lines()).toHaveLength(2);
    expect(store.lines().map((line) => line.amount)).toEqual(['300.00', '150.00']);
    expect(api.getUnreconciledPayments).toHaveBeenCalledWith('c-1');
    expect(store.payments()).toHaveLength(1);
  });

  it('shows the items with value dates and residuals, and one form per allocation line', async () => {
    await open();

    const text = document.body.textContent as string;
    expect(text).toContain('FT-1 · 1');
    expect(text).toContain('2026-03-12');
    expect(document.body.querySelectorAll('.draft-line')).toHaveLength(2);
    expect(text).toContain('AR.RESIDUAL');
  });

  it('flags an amount above the residual and blocks the submit', async () => {
    await open();
    const store = fixture.componentInstance.store;

    store.updateLine(1, { amount: '999.00' });
    fixture.detectChanges();

    expect(store.isValid()).toBe(false);
    expect(document.body.querySelector('.draft-line.invalid')).not.toBeNull();
    expect(document.body.textContent).toContain('AR.ERR_EXCEEDS_RESIDUAL');
  });

  it('allocates, tells the parent the fresh items and closes', async () => {
    await open([first]);
    const reconciled = vi.fn();
    fixture.componentInstance.reconciled.subscribe(reconciled);

    await fixture.componentInstance.submit();

    expect(api.allocate).toHaveBeenCalledTimes(1);
    expect(reconciled).toHaveBeenCalledWith([expect.objectContaining({ id: '1', status: 'paid' })]);
    expect(messageSpy.success).toHaveBeenCalledWith('AR.ALLOCATED_OK');
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('keeps the drawer open and shows the message of a refusal', async () => {
    await open([first]);
    api.allocate.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Invalid', errors: { amount: ['The amount exceeds what is open on the item.'] } },
          }),
      ),
    );
    const reconciled = vi.fn();
    fixture.componentInstance.reconciled.subscribe(reconciled);

    await fixture.componentInstance.submit();

    expect(reconciled).not.toHaveBeenCalled();
    expect(fixture.componentInstance.open()).toBe(true);
    expect(messageSpy.error).toHaveBeenCalledWith('The amount exceeds what is open on the item.');
  });

  it('does not wipe the edits when the items change while the drawer is open', async () => {
    await open();
    const store = fixture.componentInstance.store;
    store.updateLine(1, { amount: '10.00' });

    fixture.componentRef.setInput('items', [first, second]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.lines()[0].amount).toBe('10.00');
  });

  it('formats the label of an unreconciled payment', async () => {
    await open();

    expect(fixture.componentInstance.paymentLabel('BONIFICO 12', '2026-03-20', '400.00', 'EUR')).toBe(
      'BONIFICO 12 · 2026-03-20 · 400.00 EUR',
    );
    expect(fixture.componentInstance.paymentLabel(null, '2026-03-20', undefined, 'EUR')).toBe(
      '— · 2026-03-20 · EUR',
    );
  });
});
