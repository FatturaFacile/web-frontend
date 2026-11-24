import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ConsolidationGroup, ConsolidationRun } from '@core';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { GlConsolidationAccountMappingsComponent } from './gl-consolidation-account-mappings.component';
import { GlConsolidationAcquisitionsComponent } from './gl-consolidation-acquisitions.component';
import { GlConsolidationDividendsComponent } from './gl-consolidation-dividends.component';
import { GlConsolidationGroupDetailComponent } from './gl-consolidation-group-detail.component';
import { GlConsolidationGroupFormComponent } from './gl-consolidation-group-form.component';
import { GlConsolidationGroupsComponent } from './gl-consolidation-groups.component';
import { GlConsolidationMembersComponent } from './gl-consolidation-members.component';
import { GlConsolidationReconciliationComponent } from './gl-consolidation-reconciliation.component';
import { GlConsolidationRelationsComponent } from './gl-consolidation-relations.component';
import { GlConsolidationRunDetailComponent } from './gl-consolidation-run-detail.component';
import { GlConsolidationRunsComponent } from './gl-consolidation-runs.component';
import { GlConsolidationTransactionsComponent } from './gl-consolidation-transactions.component';

const base = `${environment.apiBaseUrl}/general-ledger/consolidation`;

const GROUP: ConsolidationGroup = {
  id: 'g1',
  name: 'Alpha group',
  group_currency: 'EUR',
  translation_reserve_code: 'CONS-CTA',
  consolidation_difference_code: 'CONS-DIFF',
  equity_method_result_code: 'CONS-EQM-PL',
  equity_method_reserve_code: 'CONS-EQM-RES',
  elimination_difference_policy: 'keep_difference',
  goodwill_method: 'straight_line',
  goodwill_amortisation_years: 10,
  require_account_mapping: false,
  deferred_tax_on_unrealised_profit: false,
  unrealised_profit_tax_rate: null,
  fair_value_first_year_rule: 'pro_rata',
  goodwill_translation: 'historical',
  negative_goodwill_treatment: 'consolidation_reserve',
  synthetic_accounts: {},
  is_active: true,
  notes: null,
  members: [
    {
      id: 'm1',
      member_tenant_id: 't1',
      name: 'Parent Srl',
      ownership_percentage: '100.0000',
      consolidation_method: 'full',
      is_parent: true,
      holder_tenant_id: null,
      fiscal_year_offset_months: 0,
      tax_rate: null,
      consolidation_basis: null,
    },
    {
      id: 'm2',
      member_tenant_id: 't2',
      name: 'Daughter GmbH',
      ownership_percentage: '80.0000',
      consolidation_method: 'full',
      is_parent: false,
      holder_tenant_id: 't1',
      fiscal_year_offset_months: 0,
      tax_rate: '24.0000',
      consolidation_basis: 'own_year',
    },
  ],
  relations: [
    {
      id: 'r1',
      group_id: 'g1',
      entity_a_tenant_id: 't1',
      entity_b_tenant_id: 't2',
      tolerance_amount: '1.0000',
      description: null,
      mappings: [{ id: 'p1', mapping_type: 'receivable_payable', account_a_id: 'a1', account_b_id: 'b1' }],
    },
  ],
};

const RUN: ConsolidationRun = {
  id: 'u1',
  group_id: 'g1',
  fiscal_period_id: 'per1',
  version: 2,
  status: 'completed',
  group_currency: 'EUR',
  year_start: '2026-01-01',
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  input_fingerprint: 'abcdef0123456789abcdef',
  members: [
    {
      tenant_id: 't2',
      name: 'Daughter GmbH',
      currency: 'CHF',
      ownership_percentage: '80.0000',
      consolidation_method: 'full',
      is_parent: false,
      effective_ownership: '80.0000',
      consolidation_share: '100.0000',
      year_start: '2026-01-01',
    },
  ],
  rates: [{ tenant_id: 't2', currency: 'CHF', closing: '1.0500', average: '1.0400', historical: '1.0000' }],
  warnings: [{ code: 'unclosed_period', message: 'A period is not closed' }],
  totals: { total_assets: '1000.0000', total_liabilities: '400.0000', total_equity: '600.0000', trial_balance_is_balanced: true, balance_sheet_is_balanced: true },
  locked_at: null,
  locked_by: null,
  created_by: null,
  created_at: '2026-12-31T10:00:00+00:00',
  adjustments: [],
};

describe('Consolidation pages boot against an empty backend', () => {
  const tabs = [
    ['members', GlConsolidationMembersComponent],
    ['relations', GlConsolidationRelationsComponent],
    ['account mappings', GlConsolidationAccountMappingsComponent],
    ['acquisitions', GlConsolidationAcquisitionsComponent],
    ['intragroup transactions', GlConsolidationTransactionsComponent],
    ['intragroup dividends', GlConsolidationDividendsComponent],
    ['intercompany reconciliation', GlConsolidationReconciliationComponent],
    ['runs', GlConsolidationRunsComponent],
  ] as const;

  it('groups', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(GlConsolidationGroupsComponent);

    expect(fixture.nativeElement).toBeTruthy();
    expect(requests).toContain(`GET ${base}/groups`);
  });

  it('group form', async () => {
    const { fixture } = await renderPageWithEmptyBackend(GlConsolidationGroupFormComponent, { open: true });

    expect(fixture.nativeElement).toBeTruthy();
  });

  it('group detail', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(GlConsolidationGroupDetailComponent, { id: 'g1' });

    expect(fixture.nativeElement).toBeTruthy();
    expect(requests).toContain(`GET ${base}/groups/g1`);
  });

  it.each(tabs)('%s tab', async (_name, component) => {
    const { fixture } = await renderPageWithEmptyBackend(component, { group: GROUP });

    expect(fixture.nativeElement).toBeTruthy();
  });
});

describe('Consolidation pages', () => {
  async function create<T>(component: new () => T, inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(component);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('group form creates a group: codes left empty are not sent and the currency is upper case', async () => {
    const { fixture, http } = await create(GlConsolidationGroupFormComponent, { open: true });
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      form: { patchValue(value: Record<string, unknown>): void };
      save(): void;
    };

    page.form.patchValue({ name: 'Alpha group', group_currency: 'eur', goodwill_method: 'straight_line', goodwill_amortisation_years: 10 });
    page.save();

    const request = http.expectOne(`${base}/groups`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ name: 'Alpha group', group_currency: 'EUR', goodwill_method: 'straight_line', goodwill_amortisation_years: 10 });
    expect(request.request.body).not.toHaveProperty('translation_reserve_code');
    expect(request.request.body).not.toHaveProperty('is_active');
    request.flush({ data: GROUP });
  });

  it('group form keeps the invalid form from reaching the API', async () => {
    const { fixture, http } = await create(GlConsolidationGroupFormComponent, { open: true });
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { save(): void }).save();

    http.expectNone(`${base}/groups`);
  });

  it('group detail shows the group and its members tab', async () => {
    const { fixture, http } = await create(GlConsolidationGroupDetailComponent, { id: 'g1' });
    fixture.detectChanges();

    http.expectOne(`${base}/groups/g1`).flush({ data: GROUP });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Alpha group');
    expect(text).toContain('Daughter GmbH');
  });

  it('run detail shows the run, loads a statement the first time its tab opens and locks the run', async () => {
    const { fixture, http } = await create(GlConsolidationRunDetailComponent, { runId: 'u1' });
    fixture.detectChanges();

    http.expectOne(`${base}/runs/u1`).flush({ data: RUN });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('A period is not closed');
    expect(element.textContent).toContain('Daughter GmbH');

    const page = fixture.componentInstance as unknown as {
      onTab(index: number): void;
      lock(): void;
      balance(): { assets: { account_name: string }[] } | null;
    };
    page.onTab(2);
    page.onTab(2);
    http.expectOne(`${base}/runs/u1/balance-sheet`).flush({
      data: {
        run_id: 'u1',
        version: 2,
        status: 'completed',
        currency: 'EUR',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        amounts_basis: '',
        assets: [{ account_code: '1000', account_name: 'Consolidated cash', amount: '1000.0000' }],
        total_assets: '1000.0000',
        liabilities: [],
        total_liabilities: '400.0000',
        equity: [],
        total_equity_reserves: '500.0000',
        result_of_the_period: '100.0000',
        total_equity: '600.0000',
        non_controlling_interests: '0.0000',
        equity_attributable_to_owners: '600.0000',
        total_liabilities_and_equity: '1000.0000',
        deferred_tax_asset: '0.0000',
        deferred_tax_liability: '0.0000',
        is_balanced: true,
      },
    });
    expect(page.balance()?.assets[0].account_name).toBe('Consolidated cash');

    page.lock();
    const lock = http.expectOne(`${base}/runs/u1/lock`);
    expect(lock.request.method).toBe('POST');
    lock.flush({ data: { ...RUN, status: 'locked', adjustments: undefined } });
    fixture.detectChanges();
    expect(element.textContent).toContain('GL.CONS_RUN_LOCKED');
  });
});
