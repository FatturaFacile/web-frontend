import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralLedgerApiService, GeneralLedgerFiscalApiService, PermissionsService } from '@core';
import { GlAccountsComponent } from './accounts/gl-accounts.component';
import { GlAccrualsComponent } from './accruals/gl-accruals.component';
import { GlBudgetsComponent } from './budgets/gl-budgets.component';
import { GlFiscalYearsComponent } from './fiscal-years/gl-fiscal-years.component';
import { GlRecurringComponent } from './recurring/gl-recurring.component';

interface FormHost {
  form: { reset(): void; invalid: boolean };
  save?: () => void;
  create?: () => void;
}

const calls: string[] = [];

/** An API whose every method answers with an empty page and records the write calls. */
function apiStub(): object {
  return new Proxy(
    {},
    {
      get: (_target, name: string) =>
        vi.fn((..._args: unknown[]) => {
          if (/^(create|update|set|replace)/.test(name)) {
            calls.push(name);
          }
          return of({ success: true, message: '', data: [] });
        }),
    },
  );
}

describe('General ledger forms: an empty submit does not call the API', () => {
  beforeEach(() => {
    calls.length = 0;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GeneralLedgerApiService, useValue: apiStub() },
        { provide: GeneralLedgerFiscalApiService, useValue: apiStub() },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  const cases: [string, Type<unknown>][] = [
    ['account', GlAccountsComponent],
    ['accrual', GlAccrualsComponent],
    ['budget', GlBudgetsComponent],
    ['fiscal year', GlFiscalYearsComponent],
    ['recurring journal', GlRecurringComponent],
  ];

  it.each(cases)('the %s form stays invalid and sends nothing', (_label, component) => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    const host = fixture.componentInstance as unknown as FormHost;
    const writesBefore = calls.length;

    expect(host.form.invalid).toBe(true);
    (host.save ?? host.create)?.call(host);

    expect(calls.length).toBe(writesBefore);
  });
});
