import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  PermissionsService,
  ReceivablesApiService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { CustomerStatementComponent } from './customer-statement.component';
import { statement } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('de'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('CustomerStatementComponent', () => {
  let api: Record<
    'getStatement' | 'downloadStatementPdf' | 'downloadStatementXlsx' | 'sendStatement',
    ReturnType<typeof vi.fn>
  >;
  let canWrite: boolean;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    URL.createObjectURL = vi.fn(() => 'blob:statement');
    URL.revokeObjectURL = vi.fn();
    api = {
      getStatement: vi.fn(() => of({ data: statement })),
      downloadStatementPdf: vi.fn(() => of(new Blob(['%PDF']))),
      downloadStatementXlsx: vi.fn(() => of(new Blob(['xlsx']))),
      sendStatement: vi.fn(() =>
        of({ data: { id: 's-1', status: 'queued', recipient: 'office@rossi.example' } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'statement', component: CustomerStatementComponent },
          { path: 'statement/:customerId', component: CustomerStatementComponent },
        ]),
        { provide: ReceivablesApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: {
            get: vi.fn((id: string) => of({ data: { id, company_name: 'Rossi SRL' } })),
            list: vi.fn(() => of({ data: [], meta: {} })),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
      ],
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, CustomerStatementComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  it('asks for a customer and loads nothing without one', async () => {
    const { root } = await open('/statement');

    expect(root.textContent).toContain('AR.PICK_CUSTOMER_HINT');
    expect(api.getStatement).not.toHaveBeenCalled();
  });

  it('previews the statement: balances, movements, open items and aging', async () => {
    const { root } = await open('/statement/c-1');
    const text = root.textContent as string;

    expect(api.getStatement).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ to: expect.any(String) }),
    );
    expect(text).toContain('Rossi SRL');
    expect(text).toContain('AR.OPENING_BALANCE');
    expect(text).toContain('AR.CLOSING_BALANCE');
    expect(text).toContain('BONIFICO 7');
    expect(text).toContain('FT-2');
    expect(text).toContain('AR.BUCKET_RANGE');
  });

  it('highlights the overdue open items with their days past due', async () => {
    const { root } = await open('/statement/c-1');
    const rows = root.querySelectorAll('table.matrix tbody tr.overdue-row');

    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('FT-1');
    expect(rows[0].textContent).toContain('AR.DAYS_PAST_DUE');
  });

  it('reloads the preview for another period', async () => {
    const { component } = await open('/statement/c-1');

    component.onRange([new Date(2026, 1, 1), new Date(2026, 1, 28)]);

    expect(api.getStatement).toHaveBeenLastCalledWith('c-1', {
      from: '2026-02-01',
      to: '2026-02-28',
    });
    // An incomplete range (cleared picker) changes nothing.
    component.onRange(null);
    expect(api.getStatement).toHaveBeenCalledTimes(2);
  });

  it('downloads the pdf and the excel file through the browser', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { component } = await open('/statement/c-1');

    await component.download('pdf');
    await component.download('xlsx');

    expect(api.downloadStatementPdf).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ from: expect.any(String) }),
    );
    expect(api.downloadStatementXlsx).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(2);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(
      /^statement-rossi-srl-.*\.pdf$/,
    );
    expect((click.mock.contexts[1] as HTMLAnchorElement).download).toMatch(/\.xlsx$/);
  });

  it('tells the user when a download fails', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { component } = await open('/statement/c-1');
    api.downloadStatementPdf.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    await component.download('pdf');

    expect(click).not.toHaveBeenCalled();
    expect(messageSpy.error).toHaveBeenCalledWith('AR.DOWNLOAD_ERROR');
  });

  it('sends the statement to the typed recipient in the chosen language, preset to the active one', async () => {
    const { component } = await open('/statement/c-1');

    component.openSend();
    expect(component.locale()).toBe('de');
    component.recipient.set(' office@rossi.example ');
    component.locale.set('fr');
    await component.send();

    expect(api.sendStatement).toHaveBeenCalledWith('c-1', {
      from: expect.any(String),
      to: expect.any(String),
      locale: 'fr',
      recipient: 'office@rossi.example',
    });
    expect(component.sendOpen()).toBe(false);
    expect(translateSpy.instant).toHaveBeenCalledWith('AR.SEND_QUEUED', {
      recipient: 'office@rossi.example',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('AR.SEND_QUEUED');
  });

  it('may leave the recipient empty when the customer has an e-mail, and refuses a malformed one', async () => {
    const { component } = await open('/statement/c-1');
    component.openSend();

    expect(component.sendValid()).toBe(true);
    component.recipient.set('not-an-email');
    expect(component.recipientInvalid()).toBe(true);
    expect(component.sendValid()).toBe(false);
    await component.send();
    expect(api.sendStatement).not.toHaveBeenCalled();
  });

  it('needs a recipient when the customer has no e-mail', async () => {
    api.getStatement.mockReturnValue(
      of({ data: { ...statement, customer: { ...statement.customer, email: null } } }),
    );
    const { component } = await open('/statement/c-1');
    component.openSend();

    expect(component.sendValid()).toBe(false);
    component.recipient.set('office@rossi.example');
    expect(component.sendValid()).toBe(true);
  });

  it('shows the message of the API when the send is refused', async () => {
    const { component } = await open('/statement/c-1');
    api.sendStatement.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    );
    component.openSend();

    await component.send();

    expect(messageSpy.error).toHaveBeenCalledWith('Forbidden');
    expect(component.sendOpen()).toBe(true);
  });

  it('does not offer the e-mail to a member without write access, only the downloads', async () => {
    canWrite = false;

    const { root } = await open('/statement/c-1');
    const text = root.textContent as string;

    expect(text).not.toContain('AR.SEND_EMAIL');
    expect(text).toContain('AR.DOWNLOAD_PDF');
    expect(text).toContain('AR.DOWNLOAD_XLSX');
  });
});
