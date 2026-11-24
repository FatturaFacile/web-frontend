import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { PayablesBatchWizardComponent } from './payables-batch-wizard.component';
import { apItem, batch, preview } from './payables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('PayablesBatchWizardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      previewBatch: vi.fn(() => of({ data: preview() })),
      createBatch: vi.fn(() => of({ data: batch({ id: 'b-9' }) })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'payables/batches/new', component: PayablesBatchWizardComponent },
          { path: 'payables/batches/:id', component: PayablesBatchWizardComponent },
          { path: '**', component: PayablesBatchWizardComponent },
        ]),
        { provide: PayablesApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function open() {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/payables/batches/new',
      PayablesBatchWizardComponent,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  async function toSelection(
    component: PayablesBatchWizardComponent,
    harness: RouterTestingHarness,
  ) {
    await component.propose();
    harness.detectChanges();
  }

  it('starts on the cutoff step with Skonto priority on', async () => {
    const { component, root } = await open();

    expect(component.step()).toBe(0);
    expect(component.prioritizeSkonto()).toBe(true);
    expect(root.textContent).toContain('AP.PROPOSE');
    expect(api['previewBatch']).not.toHaveBeenCalled();
  });

  it('proposes the items due by the cutoff and moves to the selection', async () => {
    const { component, harness } = await open();
    component.prioritizeSkonto.set(false);
    component.currency.set('EUR');
    await toSelection(component, harness);

    expect(api['previewBatch']).toHaveBeenCalledWith(
      expect.objectContaining({
        prioritize_skonto: false,
        currency: 'EUR',
        cutoff_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(component.step()).toBe(1);
  });

  it('lists the payable candidates with the Skonto, the credit notes to net and the excluded notice', async () => {
    const { component, harness, root } = await open();
    await toSelection(component, harness);

    expect(root.textContent).toContain('FA-i-1');
    expect(root.textContent).toContain('AP.SKONTO_DAYS_LEFT');
    expect(root.textContent).toContain('NC-1');
    expect(root.textContent).toContain('AP.EXCLUDED_NOTICE');
    const boxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(Array.from(boxes).every((box) => box.checked)).toBe(true);
  });

  it('never offers a blocked or disputed item as a candidate', async () => {
    api['previewBatch'].mockReturnValueOnce(
      of({
        data: preview({
          candidates: [
            apItem('i-1'),
            apItem('i-2', { status: 'blocked' }),
            apItem('i-3', { status: 'disputed' }),
          ],
        }),
      }),
    );
    const { component, harness, root } = await open();
    await toSelection(component, harness);

    expect(component.candidates().map((row) => row.id)).toEqual(['i-1']);
    expect(root.textContent).not.toContain('FA-i-2');
    expect(root.textContent).not.toContain('FA-i-3');
  });

  it('recomputes the batch when an item is unticked', async () => {
    const { component, harness, root } = await open();
    await toSelection(component, harness);

    const first = root.querySelector<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    ) as HTMLInputElement;
    first.checked = false;
    first.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(api['previewBatch']).toHaveBeenLastCalledWith(
      expect.objectContaining({ item_ids: ['i-2'] }),
    );
  });

  it('shows no step further without a selected item', async () => {
    api['previewBatch'].mockReturnValueOnce(
      of({ data: preview({ candidates: [], credit_notes: [] }) }),
    );
    const { component, harness, root } = await open();
    await toSelection(component, harness);

    expect(root.textContent).toContain('AP.NO_CANDIDATES');
  });

  it('reviews the transfers grouped by IBAN with the set-off, then creates the draft and opens it', async () => {
    const { component, harness, root } = await open();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await toSelection(component, harness);
    component.step.set(2);
    harness.detectChanges();

    expect(root.textContent).toContain('AP.TRANSFERS_BY_IBAN');
    expect(root.textContent).toContain('IT60 X054 2811 1010 0000 0123 456');
    expect(root.textContent).toContain('NC-1');
    expect(root.textContent).toContain('AP.TOTAL_NET');

    await component.create();

    expect(api['createBatch']).toHaveBeenCalledWith(
      expect.objectContaining({ item_ids: ['i-1', 'i-2'], set_off_ids: ['cn-1'] }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('AP.BATCH_CREATED');
    expect(navigate).toHaveBeenCalledWith(['/payables/batches', 'b-9']);
  });

  it('shows the error of a failed creation and stays on the review', async () => {
    api['createBatch'].mockReturnValueOnce(throwError(() => new Error('offline')));
    const { component, harness } = await open();
    await toSelection(component, harness);
    component.step.set(2);
    await component.create();

    expect(component.submitError()).toBe('AP.SAVE_ERROR');
    expect(component.step()).toBe(2);
  });

  it('stays on the first step when the proposal cannot be calculated', async () => {
    api['previewBatch'].mockReturnValueOnce(throwError(() => new Error('offline')));
    const { component, harness, root } = await open();
    await component.propose();
    harness.detectChanges();

    expect(component.step()).toBe(0);
    expect(root.textContent).toContain('AP.PREVIEW_ERROR');
  });
});
