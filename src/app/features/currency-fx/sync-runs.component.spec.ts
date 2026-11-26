import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { baseProviders, page, settle, syncRun, wrap } from './currency-fx.testing';
import { SyncRunsComponent } from './sync-runs.component';

describe('SyncRunsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let message: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    api = {
      listSyncRuns: vi.fn(() =>
        of(
          page([
            syncRun('1', { provider: 'ecb', status: 'succeeded' }),
            syncRun('2', {
              provider: 'snb',
              status: 'failed',
              trigger: 'manual',
              error_message: 'SNB endpoint timed out',
              finished_at: null,
            }),
            syncRun('3', { provider: 'estv', status: 'running', finished_at: null }),
          ]),
        ),
      ),
      syncRates: vi.fn(() => of(wrap({ runs: [syncRun('4', { status: 'queued' })] }))),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api, message) });
  });

  async function render() {
    const fixture = TestBed.createComponent(SyncRunsComponent);
    await settle(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function rowOf(root: HTMLElement, text: string): Element | undefined {
    return Array.from(root.querySelectorAll('tbody tr.ant-table-row')).find((row) =>
      (row.textContent ?? '').includes(text),
    );
  }

  it('lists the runs with a status tag for each state', async () => {
    const { root } = await render();

    expect(root.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(3);
    const tag = (provider: string) =>
      rowOf(root, `FINANCE.CURRENCIES.PROVIDER.${provider}`)?.querySelector(
        'nz-tag',
      ) as HTMLElement;

    expect(tag('ecb').textContent).toContain('FINANCE.CURRENCIES.SYNC_STATUS.succeeded');
    expect(tag('ecb').classList.contains('ant-tag-success')).toBe(true);
    expect(tag('snb').textContent).toContain('FINANCE.CURRENCIES.SYNC_STATUS.failed');
    expect(tag('snb').classList.contains('ant-tag-error')).toBe(true);
    expect(tag('estv').textContent).toContain('FINANCE.CURRENCIES.SYNC_STATUS.running');
    expect(tag('estv').classList.contains('ant-tag-processing')).toBe(true);
  });

  it('shows the error message of a failed run', async () => {
    const { root } = await render();

    expect(
      rowOf(root, 'SNB endpoint timed out')?.querySelector('.sync-error')?.textContent,
    ).toContain('SNB endpoint timed out');
    expect(
      rowOf(root, 'FINANCE.CURRENCIES.PROVIDER.ecb')
        ?.querySelector('.sync-error')
        ?.textContent?.trim(),
    ).toBe('');
  });

  it('queues a synchronisation with "update now" and reloads the runs', async () => {
    const { fixture, root } = await render();
    api['listSyncRuns'].mockClear();

    (root.querySelector('.sync-now') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api['syncRates']).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith('FINANCE.CURRENCIES.MESSAGE.SYNC_QUEUED');
    expect(api['listSyncRuns']).toHaveBeenCalledTimes(1);
    expect(root.querySelector('nz-alert')).toBeNull();
  });

  it('shows a warning, not an error, when a synchronisation is already running (409)', async () => {
    api['syncRates'].mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { message: 'Already running' } }),
      ),
    );
    const { fixture, root } = await render();

    (root.querySelector('.sync-now') as HTMLButtonElement).click();
    await settle(fixture);

    const alert = root.querySelector('nz-alert');
    expect(
      alert?.classList.contains('ant-alert-warning') || alert?.querySelector('.ant-alert-warning'),
    ).toBeTruthy();
    expect(alert?.textContent).toContain('FINANCE.CURRENCIES.MESSAGE.SYNC_ALREADY_RUNNING');
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  });

  it('shows an error for any other failure of the update', async () => {
    api['syncRates'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Boom' } })),
    );
    const { fixture, root } = await render();

    (root.querySelector('.sync-now') as HTMLButtonElement).click();
    await settle(fixture);

    expect(root.querySelector('nz-alert')?.textContent).toContain(
      'FINANCE.CURRENCIES.ERROR.SYNC_FAILED',
    );
    expect(root.querySelector('nz-alert')?.textContent).toContain('Boom');
  });

  it('hides "update now" when the member cannot write', async () => {
    const fixture = TestBed.createComponent(SyncRunsComponent);
    fixture.componentRef.setInput('canWrite', false);
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).querySelector('.sync-now')).toBeNull();
  });
});
