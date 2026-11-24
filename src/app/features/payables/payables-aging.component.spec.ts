import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService, TranslateService } from '@core';
import * as shared from '@shared';
import { icons } from '../../icons-provider';
import { PayablesAgingComponent } from './payables-aging.component';
import { aging } from './payables.fixtures';

vi.mock('@shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared')>()),
  downloadBlob: vi.fn(),
}));

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('PayablesAgingComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getAging: vi.fn(() => of({ data: aging })),
      exportAging: vi.fn(() => of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: PayablesAgingComponent }]),
        { provide: PayablesApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function open() {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/', PayablesAgingComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  function exportButton(root: HTMLElement, key: string): HTMLButtonElement {
    return Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(key),
    ) as HTMLButtonElement;
  }

  it('shows a column for every bucket of the response and a row per supplier', async () => {
    const { root } = await open();
    const heads = Array.from(root.querySelectorAll('table.matrix thead th')).map((th) =>
      th.textContent?.trim(),
    );

    expect(heads).toEqual([
      'AP.SUPPLIER',
      'AP.BUCKET_CURRENT',
      'AP.BUCKET_RANGE',
      'AP.BUCKET_RANGE',
      'AP.BUCKET_RANGE',
      'AP.BUCKET_OVER',
      'AP.TOTAL_OPEN',
      'AP.TOTAL_OVERDUE',
    ]);
    expect(root.querySelectorAll('table.matrix tbody tr')).toHaveLength(2);
    expect(root.querySelector('table.matrix tbody')?.textContent).toContain('Acme Forniture');
    expect(root.querySelector('table.matrix tfoot')?.textContent).toContain('AP.TOTAL');
  });

  it('links each supplier to its open items', async () => {
    const { root } = await open();
    const link = root.querySelector('table.matrix tbody a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toContain('supplier_id=s-1');
  });

  it('reloads on a new currency', async () => {
    const { component } = await open();
    await component.store.setFilters({ currency: 'CHF' });

    expect(api['getAging']).toHaveBeenLastCalledWith({ currency: 'CHF' });
  });

  it('downloads the Excel export', async () => {
    const { root, harness } = await open();
    exportButton(root, 'AP.EXPORT_XLSX').click();
    await harness.fixture.whenStable();

    expect(api['exportAging']).toHaveBeenCalledWith('xlsx', {});
    expect(shared.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'payables-aging-2026-04-01.xlsx',
    );
  });

  it('downloads the PDF export', async () => {
    const { root, harness } = await open();
    exportButton(root, 'AP.EXPORT_PDF').click();
    await harness.fixture.whenStable();

    expect(api['exportAging']).toHaveBeenCalledWith('pdf', {});
    expect(shared.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'payables-aging-2026-04-01.pdf',
    );
  });

  it('shows the error of a failed export and downloads nothing', async () => {
    api['exportAging'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'no file' } })),
    );
    const { component } = await open();
    await component.download('pdf');

    expect(shared.downloadBlob).not.toHaveBeenCalled();
    expect(messageSpy.error).toHaveBeenCalledWith('no file');
  });

  it('disables the exports without data', async () => {
    api['getAging'].mockReturnValueOnce(of({ data: { ...aging, suppliers: [] } }));
    const { root } = await open();

    expect(exportButton(root, 'AP.EXPORT_XLSX').disabled).toBe(true);
    expect(exportButton(root, 'AP.EXPORT_PDF').disabled).toBe(true);
    expect(root.textContent).toContain('AP.NO_AGING');
  });
});
