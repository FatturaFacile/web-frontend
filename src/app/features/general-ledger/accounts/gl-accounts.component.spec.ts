import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GlAccountsComponent } from './gl-accounts.component';

describe('GlAccountsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlAccountsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  function flushInitialLoads(uiCopy: Record<string, string> = {}): void {
    httpMock.match((req) => req.url.includes('/accounts-tree')).forEach((r) => r.flush({ data: [], meta: { total_accounts: 0, postable_accounts: 0, active_accounts: 0, max_depth: 0, standards: [], ui_copy: uiCopy } }));
    httpMock.match((req) => req.url.includes('/account-templates')).forEach((r) => r.flush({ data: [], ui_copy: uiCopy }));
    httpMock.match((req) => req.url.includes('/account-mappings')).forEach((r) => r.flush({ data: [], incoming: [], tree: [] }));
    httpMock.match((req) => req.url.includes('/vat-codes')).forEach((r) => r.flush({ data: [] }));
    httpMock.match((req) => req.url.includes('/cost-centers')).forEach((r) => r.flush({ data: [] }));
    httpMock.match((req) => req.url.endsWith('/accounts')).forEach((r) => r.flush({ data: [] }));
  }

  it('renders backend-seeded uiCopy title and keeps form invalid initially', () => {
    const fixture = TestBed.createComponent(GlAccountsComponent);
    fixture.detectChanges();
    flushInitialLoads({ page_title: 'Piano dei Conti Multi-Standard' });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Piano dei Conti Multi-Standard');
  });

  it('flags balanceCoherenceWarning when asset account is set to credit', () => {
    const fixture = TestBed.createComponent(GlAccountsComponent);
    fixture.detectChanges();
    flushInitialLoads();

    fixture.componentInstance.form.patchValue({
      account_type: 'asset',
      normal_balance: 'credit',
    });

    expect(fixture.componentInstance.balanceCoherenceWarning()).toBe(true);

    fixture.componentInstance.form.patchValue({ normal_balance: 'debit' });
    expect(fixture.componentInstance.balanceCoherenceWarning()).toBe(false);
  });

  it('does not issue HTTP writes when save() is called with invalid form', () => {
    const fixture = TestBed.createComponent(GlAccountsComponent);
    fixture.detectChanges();
    flushInitialLoads();

    fixture.componentInstance.save();
    httpMock.expectNone((req) => req.method === 'POST' || req.method === 'PUT');
  });
});
