import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApBatchStatus, PayablesApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { PayablesBatchDetailComponent } from './payables-batch-detail.component';
import { batch } from './payables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('PayablesBatchDetailComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;
  let canApprove: boolean;
  let status: ApBatchStatus;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    canApprove = false;
    status = 'draft';
    api = {
      getBatch: vi.fn(() => of({ data: batch({ status }) })),
      submitBatch: vi.fn(() => of({ data: batch({ status: 'pending_approval' }) })),
      approveBatch: vi.fn(() => of({ data: batch({ status: 'approved' }) })),
      rejectBatch: vi.fn(() => of({ data: batch({ status: 'rejected' }) })),
      executeBatch: vi.fn(() => of({ data: batch({ status: 'executed' }) })),
      cancelBatch: vi.fn(() => of({ data: batch({ status: 'cancelled' }) })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'payables/batches/:id', component: PayablesBatchDetailComponent }]),
        { provide: PayablesApiService, useValue: api },
        {
          provide: PermissionsService,
          useValue: {
            canWrite: (module: string) => (module === 'payables_approval' ? canApprove : canWrite),
          },
        },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function open() {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/payables/batches/b-1',
      PayablesBatchDetailComponent,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  function has(root: HTMLElement, key: string): boolean {
    return Array.from(root.querySelectorAll('button')).some((button) =>
      button.textContent?.includes(key),
    );
  }

  it('loads the batch of the url and shows the totals, the set-off and the transfers by IBAN', async () => {
    const { root } = await open();

    expect(api['getBatch']).toHaveBeenCalledWith('b-1');
    expect(root.textContent).toContain('AP.BATCH_DRAFT');
    expect(root.textContent).toContain('AP.TOTAL_SET_OFF');
    expect(root.textContent).toContain('NC-1');
    expect(root.textContent).toContain('IT60 X054 2811 1010 0000 0123 456');
  });

  it('lets an accountant submit a draft to the CFO but not approve it', async () => {
    const { root } = await open();

    expect(has(root, 'AP.SUBMIT_CFO')).toBe(true);
    expect(has(root, 'AP.APPROVE')).toBe(false);
    expect(has(root, 'AP.EXECUTE')).toBe(false);
  });

  it('submits for CFO approval and confirms it', async () => {
    const { root, harness } = await open();
    (
      Array.from(root.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('AP.SUBMIT_CFO'),
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(api['submitBatch']).toHaveBeenCalledWith('b-1');
    expect(messageSpy.success).toHaveBeenCalledWith('AP.SUBMITTED');
    expect(root.textContent).toContain('AP.BATCH_PENDING_APPROVAL');
  });

  it('lets the CFO approve or reject a batch pending approval', async () => {
    status = 'pending_approval';
    canApprove = true;
    const { root, component } = await open();

    expect(has(root, 'AP.APPROVE')).toBe(true);
    expect(has(root, 'AP.REJECT')).toBe(true);
    expect(has(root, 'AP.SUBMIT_CFO')).toBe(false);

    await component.run(component.store.approve('b-1'), 'AP.APPROVED');
    expect(api['approveBatch']).toHaveBeenCalledWith('b-1', {});
    expect(messageSpy.success).toHaveBeenCalledWith('AP.APPROVED');
  });

  it('rejects with the reason and closes the dialog', async () => {
    status = 'pending_approval';
    canApprove = true;
    const { component } = await open();
    component.rejectOpen.set(true);
    component.rejectReason.set(' cash is short ');
    await component.confirmReject();

    expect(api['rejectBatch']).toHaveBeenCalledWith('b-1', { reason: 'cash is short' });
    expect(component.rejectOpen()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalledWith('AP.REJECTED');
  });

  it('hides the approval actions from those who cannot approve', async () => {
    status = 'pending_approval';
    const { root } = await open();

    expect(has(root, 'AP.APPROVE')).toBe(false);
    expect(has(root, 'AP.REJECT')).toBe(false);
  });

  it('lets the CFO execute an approved batch and reports the posted Skonto', async () => {
    status = 'approved';
    canApprove = true;
    const { root, component, harness } = await open();

    expect(has(root, 'AP.EXECUTE')).toBe(true);
    await component.run(component.store.execute('b-1'), 'AP.EXECUTED');
    harness.detectChanges();

    expect(api['executeBatch']).toHaveBeenCalledWith('b-1');
    expect(messageSpy.success).toHaveBeenCalledWith('AP.EXECUTED');
    expect(root.textContent).toContain('AP.EXECUTED_NOTICE');
    expect(has(root, 'AP.EXECUTE')).toBe(false);
  });

  it('cannot cancel or execute an executed batch', async () => {
    status = 'executed';
    canApprove = true;
    const { root } = await open();

    expect(has(root, 'AP.EXECUTE')).toBe(false);
    expect(has(root, 'AP.CANCEL_BATCH')).toBe(false);
    expect(has(root, 'AP.SUBMIT_CFO')).toBe(false);
  });

  it('shows a failed transition without changing the status', async () => {
    api['submitBatch'].mockReturnValueOnce(throwError(() => new Error('offline')));
    const { component, harness, root } = await open();
    await component.run(component.store.submit('b-1'), 'AP.SUBMITTED');
    harness.detectChanges();

    expect(component.actionError()).toBe('AP.SAVE_ERROR');
    expect(root.textContent).toContain('AP.SAVE_ERROR');
    expect(component.store.detail()?.status).toBe('draft');
  });

  it('shows the approval decision of the CFO', async () => {
    api['getBatch'].mockReturnValueOnce(
      of({
        data: batch({
          status: 'rejected',
          approval: {
            user_name: 'Carla',
            decision: 'rejected',
            reason: 'cash is short',
            decided_at: '2026-04-02T10:00:00Z',
          },
        }),
      }),
    );
    const { root } = await open();

    expect(root.textContent).toContain('AP.DECISION_REJECTED');
    expect(root.textContent).toContain('cash is short');
  });
});
