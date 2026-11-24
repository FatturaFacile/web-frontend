import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { PayablesItemsComponent } from './payables-items.component';
import { apItem, skonto } from './payables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };
const meta = { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 4, total: 4 };

describe('PayablesItemsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;
  const rows = [
    apItem('1', { skonto: skonto({ days_remaining: 2 }) }),
    apItem('2', { status: 'blocked', block_reason: 'wrong quantity' }),
    apItem('3', { status: 'disputed', block_reason: 'wrong price', due_date: '2020-01-01' }),
    apItem('4', {
      document_type: 'credit_note',
      open_amount: '-150.00',
      skonto: skonto({ days_remaining: -3 }),
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      listItems: vi.fn(() => of({ data: rows, meta })),
      getItemSummary: vi.fn(() =>
        of({
          data: {
            total_open: '3000.00',
            total_overdue: '1000.00',
            skonto_savings: '20.00',
            blocked_count: 2,
            currency: 'EUR',
          },
        }),
      ),
      getItem: vi.fn((id: string) =>
        of({
          data: {
            ...apItem(id, { status: 'blocked' }),
            block_history: [
              {
                id: 'e-1',
                kind: 'block',
                reason: 'wrong quantity',
                user_name: 'Anna',
                created_at: '2026-04-01T09:00:00Z',
              },
              {
                id: 'e-2',
                kind: 'release',
                reason: 'fixed',
                user_name: 'Anna',
                created_at: '2026-04-02T09:00:00Z',
              },
            ],
          },
        }),
      ),
      block: vi.fn((id: string) =>
        of({ data: apItem(id, { status: 'blocked', block_reason: 'x' }) }),
      ),
      release: vi.fn((id: string) => of({ data: apItem(id) })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: PayablesItemsComponent }]),
        { provide: PayablesApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function open(url = '/') {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, PayablesItemsComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  function rowsOf(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('tbody tr')).filter((row) =>
      row.querySelector('td'),
    );
  }

  it('opens on the filters of the url', async () => {
    await open('/?supplier_id=s-1&skonto_only=1&due_to=2026-04-30');

    expect(api['listItems']).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier_id: 's-1',
        skonto_only: true,
        due_to: '2026-04-30',
        open_only: true,
        page: 1,
      }),
    );
  });

  it('shows the totals of the schedule', async () => {
    const { root } = await open();

    expect(root.textContent).toContain('AP.KPI_OPEN');
    expect(root.textContent).toContain('AP.KPI_SKONTO');
    expect(root.textContent).toContain('AP.KPI_BLOCKED');
  });

  it('lists the items with status, document type and Skonto opportunity', async () => {
    const { root } = await open();
    const body = rowsOf(root);

    expect(body).toHaveLength(4);
    expect(body[0].textContent).toContain('FA-1');
    expect(body[0].textContent).toContain('AP.STATUS_OPEN');
    expect(body[0].textContent).toContain('AP.DOCTYPE_XML_INVOICE');
    expect(body[0].textContent).toContain('AP.SKONTO_DAYS_LEFT');
    expect(body[0].textContent).toContain('AP.SKONTO_SAVINGS');
    expect(body[3].textContent).toContain('AP.DOCTYPE_CREDIT_NOTE');
  });

  it('shows an expired Skonto without savings and a plain item without any', async () => {
    const { root } = await open();
    const body = rowsOf(root);

    expect(body[3].textContent).toContain('AP.SKONTO_EXPIRED_DAYS');
    expect(body[3].textContent).not.toContain('AP.SKONTO_SAVINGS');
    expect(body[1].textContent).not.toContain('AP.SKONTO_DAYS_LEFT');
  });

  it('highlights the blocked and disputed items with their reason and flags the overdue one', async () => {
    const { root } = await open();
    const body = rowsOf(root);

    expect(body[1].classList.contains('blocked-row')).toBe(true);
    expect(body[1].textContent).toContain('AP.STATUS_BLOCKED');
    expect(body[1].textContent).toContain('wrong quantity');
    expect(body[2].classList.contains('blocked-row')).toBe(true);
    expect(body[2].textContent).toContain('AP.STATUS_DISPUTED');
    expect(body[2].textContent).toContain('AP.OVERDUE');
    expect(body[0].classList.contains('blocked-row')).toBe(false);
  });

  it('offers to block an open item and to release a blocked or disputed one', async () => {
    const { root } = await open();
    const body = rowsOf(root);

    expect(body[0].textContent).toContain('AP.BLOCK_ACTION');
    expect(body[0].textContent).not.toContain('AP.RELEASE_ACTION');
    expect(body[1].textContent).toContain('AP.RELEASE_ACTION');
    expect(body[1].textContent).not.toContain('AP.BLOCK_ACTION');
    expect(body[2].textContent).toContain('AP.RELEASE_ACTION');
  });

  it('shows no write action to a read-only member', async () => {
    canWrite = false;
    const { root } = await open();

    expect(root.textContent).not.toContain('AP.BLOCK_ACTION');
    expect(root.textContent).not.toContain('AP.RELEASE_ACTION');
    expect(root.textContent).toContain('AP.DETAIL');
  });

  it('puts an item in dispute with the reason and confirms it', async () => {
    const { component, harness } = await open();
    component.openBlock(rows[0]);
    component.blockKind.set('dispute');
    component.blockReason.set('  wrong price ');
    await component.confirmBlock();
    harness.detectChanges();

    expect(api['block']).toHaveBeenCalledWith('1', { kind: 'dispute', reason: 'wrong price' });
    expect(component.blockTarget()).toBeNull();
    expect(messageSpy.success).toHaveBeenCalledWith('AP.BLOCK_DONE');
    expect(
      rowsOf(harness.fixture.nativeElement as HTMLElement)[0].classList.contains('blocked-row'),
    ).toBe(true);
  });

  it('blocks administratively and keeps the dialog open on a validation error', async () => {
    api['block'].mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'x', errors: { reason: ['Reason is required'] } },
          }),
      ),
    );
    const { component } = await open();
    component.openBlock(rows[0]);
    component.blockKind.set('block');
    component.blockReason.set('r');
    await component.confirmBlock();

    expect(api['block']).toHaveBeenCalledWith('1', { kind: 'block', reason: 'r' });
    expect(component.blockTarget()).not.toBeNull();
    expect(component.blockError()).toBe('Reason is required');
    expect(messageSpy.success).not.toHaveBeenCalled();
  });

  it('releases an item with the audit reason', async () => {
    const { component } = await open();
    component.openRelease(rows[1]);
    component.releaseReason.set('documents received');
    await component.confirmRelease();

    expect(api['release']).toHaveBeenCalledWith('2', { reason: 'documents received' });
    expect(component.releaseTarget()).toBeNull();
    expect(messageSpy.success).toHaveBeenCalledWith('AP.RELEASE_DONE');
  });

  it('shows the generic error when a release fails without details', async () => {
    api['release'].mockReturnValueOnce(throwError(() => new Error('offline')));
    const { component } = await open();
    component.openRelease(rows[1]);
    component.releaseReason.set('x');
    await component.confirmRelease();

    expect(component.releaseError()).toBe('AP.SAVE_ERROR');
    expect(component.releaseTarget()).not.toBeNull();
  });

  it('opens the detail with the block and release history', async () => {
    const { component } = await open();
    await component.store.openDetail('2');

    expect(api['getItem']).toHaveBeenCalledWith('2');
    expect(component.store.detail()?.block_history).toHaveLength(2);
  });

  it('shows the empty state', async () => {
    api['listItems'].mockReturnValueOnce(of({ data: [], meta: { ...meta, total: 0 } }));
    const { root } = await open();

    expect(root.textContent).toContain('AP.NO_ITEMS');
  });

  it('shows the load error', async () => {
    api['listItems'].mockReturnValueOnce(throwError(() => new Error('offline')));
    const { root } = await open();

    expect(root.textContent).toContain('AP.LOAD_ERROR');
  });
});
