import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItalianPayrollApiService, MyPayslip } from '@core';
import { MyPayslipsComponent } from './my-payslips.component';
import { availableDocuments, groupPayslipsByYear, payslipFilename } from './my-payslips.util';

const saveBlob = vi.hoisted(() => vi.fn());

vi.mock('../shared/hr-http.util', async (original) => ({
  ...(await original<typeof import('../shared/hr-http.util')>()),
  saveBlob,
}));

const payslip = (over: Partial<MyPayslip> = {}): MyPayslip => ({
  distribution_id: 'd1',
  year: 2027,
  month: 3,
  net_amount: 1850.5,
  has_cedolino: true,
  has_cu: false,
  first_viewed_at: null,
  ...over,
});

describe('my-payslips util', () => {
  it('groups by year newest first and the months newest first', () => {
    const groups = groupPayslipsByYear([
      payslip({ distribution_id: 'a', year: 2026, month: 12 }),
      payslip({ distribution_id: 'b', year: 2027, month: 1 }),
      payslip({ distribution_id: 'c', year: 2026, month: 11 }),
      payslip({ distribution_id: 'd', year: 2027, month: 3 }),
    ]);

    expect(groups.map((g) => g.year)).toEqual([2027, 2026]);
    expect(groups[0].payslips.map((p) => p.distribution_id)).toEqual(['d', 'b']);
    expect(groups[1].payslips.map((p) => p.distribution_id)).toEqual(['a', 'c']);
    expect(groupPayslipsByYear([])).toEqual([]);
  });

  it('lists the documents of a row and names the files', () => {
    expect(availableDocuments(payslip())).toEqual(['cedolino']);
    expect(availableDocuments(payslip({ has_cedolino: false, has_cu: true }))).toEqual(['cu']);
    expect(availableDocuments(payslip({ has_cu: true }))).toEqual(['cedolino', 'cu']);
    expect(availableDocuments(payslip({ has_cedolino: false }))).toEqual([]);
    expect(payslipFilename({ year: 2027, month: 3 }, 'cedolino')).toBe('cedolino-2027-03.pdf');
    expect(payslipFilename({ year: 2026, month: 12 }, 'cu')).toBe('CU-2026.pdf');
  });
});

describe('MyPayslipsComponent', () => {
  const error = vi.fn();
  const revoke = vi.fn();
  const create = vi.fn().mockReturnValue('blob:payslip');

  beforeEach(() => {
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  });

  afterEach(() => {
    error.mockReset();
    revoke.mockReset();
    create.mockClear();
    saveBlob.mockReset();
  });

  async function setup(api: Partial<Record<keyof ItalianPayrollApiService, unknown>>) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: ItalianPayrollApiService, useValue: api },
        { provide: NzMessageService, useValue: { error } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MyPayslipsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  const query = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string) =>
    fixture.nativeElement.querySelector(selector) as T | null;

  it('shows the empty state', async () => {
    const fixture = await setup({ getMyPayslips: () => of({ data: [] }) });

    expect(query(fixture, '[data-testid=mine-empty]')).not.toBeNull();
    expect(query(fixture, '[data-testid=mine-row]')).toBeNull();
  });

  it('shows an error state and a toast when the list fails', async () => {
    const fixture = await setup({
      getMyPayslips: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    expect(query(fixture, '[data-testid=mine-error]')).not.toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('opens the document of the right kind, previews it and revokes the URL on close', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    const openMyPayslip = vi.fn().mockReturnValue(of(blob));
    const fixture = await setup({
      getMyPayslips: () =>
        of({ data: [payslip({ has_cu: true }), payslip({ distribution_id: 'd0', month: 2 })] }),
      openMyPayslip,
    });

    expect(fixture.nativeElement.querySelectorAll('[data-testid=mine-row]').length).toBe(2);

    query<HTMLButtonElement>(fixture, '[data-testid=mine-open-cu]')?.click();
    fixture.detectChanges();

    expect(openMyPayslip).toHaveBeenCalledWith('d1', 'cu');
    expect(create).toHaveBeenCalledWith(blob);
    expect(query(fixture, '[data-testid=mine-preview] iframe')).not.toBeNull();
    expect(query(fixture, '[data-testid=mine-preview] iframe')?.getAttribute('sandbox')).toBe('');

    query<HTMLButtonElement>(fixture, '[data-testid=mine-download]')?.click();
    expect(saveBlob).toHaveBeenCalledWith(blob, 'CU-2027.pdf');

    query<HTMLButtonElement>(fixture, '[data-testid=mine-close]')?.click();
    fixture.detectChanges();

    expect(revoke).toHaveBeenCalledWith('blob:payslip');
    expect(query(fixture, '[data-testid=mine-preview]')).toBeNull();
  });

  it('revokes the URL of an open preview when the page is destroyed', async () => {
    const fixture = await setup({
      getMyPayslips: () => of({ data: [payslip()] }),
      openMyPayslip: () => of(new Blob(['%PDF'])),
    });

    query<HTMLButtonElement>(fixture, '[data-testid=mine-open-cedolino]')?.click();
    fixture.detectChanges();
    fixture.destroy();

    expect(revoke).toHaveBeenCalledWith('blob:payslip');
  });

  it('shows a toast and no preview when the document cannot be opened', async () => {
    const fixture = await setup({
      getMyPayslips: () => of({ data: [payslip()] }),
      openMyPayslip: () => throwError(() => new HttpErrorResponse({ status: 403 })),
    });

    query<HTMLButtonElement>(fixture, '[data-testid=mine-open-cedolino]')?.click();
    fixture.detectChanges();

    expect(error).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(query(fixture, '[data-testid=mine-preview]')).toBeNull();
  });
});
