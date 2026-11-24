import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService } from '@core';
import { CustomerStatementStore } from './customer-statement.store';
import { statement } from './receivables.fixtures';

describe('CustomerStatementStore', () => {
  let api: Record<'getStatement' | 'downloadStatementPdf' | 'downloadStatementXlsx' | 'sendStatement', ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof CustomerStatementStore>;

  beforeEach(() => {
    api = {
      getStatement: vi.fn(() => of({ data: statement })),
      downloadStatementPdf: vi.fn(() => of(new Blob(['%PDF']))),
      downloadStatementXlsx: vi.fn(() => of(new Blob(['xlsx']))),
      sendStatement: vi.fn(() =>
        of({ data: { id: 's-1', status: 'queued', recipient: 'ar@rossi.example' } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [CustomerStatementStore, { provide: ReceivablesApiService, useValue: api }],
    });
    store = TestBed.inject(CustomerStatementStore);
  });

  it('opens the statement of a customer on a period', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');

    expect(api.getStatement).toHaveBeenCalledWith('c-1', { from: '2026-01-01', to: '2026-03-31' });
    expect(store.statement()?.closing_balance).toBe('200.00');
    expect(store.openItems()).toHaveLength(2);
    expect(store.overdueItems().map((row) => row.document_number)).toEqual(['FT-1']);
    expect(store.customerEmail()).toBe('ar@rossi.example');
  });

  it('reloads when the period or the currency change', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');

    await store.setPeriod('2026-02-01', '2026-02-28');
    expect(api.getStatement).toHaveBeenLastCalledWith('c-1', { from: '2026-02-01', to: '2026-02-28' });

    await store.setCurrency('CHF');
    expect(api.getStatement).toHaveBeenLastCalledWith('c-1', {
      from: '2026-02-01',
      to: '2026-02-28',
      currency: 'CHF',
    });
  });

  it('does not ask the API for an inverted period', async () => {
    await store.open('c-1', '2026-03-31', '2026-01-01');

    expect(store.periodIsValid()).toBe(false);
    expect(api.getStatement).not.toHaveBeenCalled();
  });

  it('forgets the previous customer when another one is opened', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');
    await store.setCurrency('CHF');

    api.getStatement.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Not found' } })),
    );
    await store.open('c-2');

    expect(store.statement()).toBeNull();
    expect(store.currency()).toBeNull();
    expect(store.error()).toBe('Not found');
  });

  it('downloads the pdf and the excel file with the name of the customer and the period', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');

    const pdf = await store.download('pdf');
    expect(pdf.ok).toBe(true);
    expect(pdf.blob).toBeInstanceOf(Blob);
    expect(pdf.filename).toBe('statement-rossi-srl-2026-01-01-2026-03-31.pdf');
    expect(api.downloadStatementPdf).toHaveBeenCalledWith('c-1', { from: '2026-01-01', to: '2026-03-31' });

    const xlsx = await store.download('xlsx');
    expect(xlsx.filename).toBe('statement-rossi-srl-2026-01-01-2026-03-31.xlsx');
    expect(store.downloading()).toBeNull();
  });

  it('reports a failed download', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');
    api.downloadStatementPdf.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    const result = await store.download('pdf');

    expect(result.ok).toBe(false);
    expect(result.blob).toBeNull();
    expect(store.downloading()).toBeNull();
  });

  it('sends the statement to a recipient in a language, or to the customer e-mail when none is given', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');

    const sent = await store.send(' office@rossi.example ', 'de');
    expect(sent.ok).toBe(true);
    expect(sent.result?.status).toBe('queued');
    expect(api.sendStatement).toHaveBeenCalledWith('c-1', {
      from: '2026-01-01',
      to: '2026-03-31',
      locale: 'de',
      recipient: 'office@rossi.example',
    });

    await store.send(null, 'it');
    expect(api.sendStatement).toHaveBeenLastCalledWith('c-1', {
      from: '2026-01-01',
      to: '2026-03-31',
      locale: 'it',
    });
    expect(store.sending()).toBe(false);
  });

  it('returns the validation error of a refused send', async () => {
    await store.open('c-1', '2026-01-01', '2026-03-31');
    api.sendStatement.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Invalid', errors: { recipient: ['The recipient must be a valid email address.'] } },
          }),
      ),
    );

    const result = await store.send('nope', 'en');

    expect(result.ok).toBe(false);
    expect(result.errors['recipient']).toEqual(['The recipient must be a valid email address.']);
    expect(result.result).toBeNull();
  });
});
