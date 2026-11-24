import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { PayablesBatchesComponent } from './payables-batches.component';
import { batch } from './payables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const meta = { current_page: 1, from: 1, last_page: 1, per_page: 20, to: 2, total: 2 };

describe('PayablesBatchesComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      listBatches: vi.fn(() =>
        of({
          data: [batch(), batch({ id: 'b-2', number: 'DP-2026-0002', status: 'pending_approval' })],
          meta,
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: PayablesBatchesComponent }]),
        { provide: PayablesApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function open() {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/', PayablesBatchesComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  it('lists the batches with status, net total and transfers', async () => {
    const { root } = await open();
    const body = Array.from(root.querySelectorAll('tbody tr')).filter((row) =>
      row.querySelector('td'),
    );

    expect(body).toHaveLength(2);
    expect(body[0].textContent).toContain('DP-2026-0001');
    expect(body[0].textContent).toContain('AP.BATCH_DRAFT');
    expect(body[1].textContent).toContain('AP.BATCH_PENDING_APPROVAL');
  });

  it('filters by status from the first page', async () => {
    const { component } = await open();
    await component.store.setStatus('approved');

    expect(api['listBatches']).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'approved', page: 1 }),
    );
  });

  it('offers the new batch to those who can write', async () => {
    const { root } = await open();

    expect(root.textContent).toContain('AP.NEW_BATCH');
  });

  it('hides the new batch from a read-only member', async () => {
    canWrite = false;
    const { root } = await open();

    expect(root.textContent).not.toContain('AP.NEW_BATCH');
  });
});
