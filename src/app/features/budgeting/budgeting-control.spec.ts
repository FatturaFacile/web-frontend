import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AccountingApiService,
  BudgetGrid,
  BudgetingApiService,
  BudgetOverride,
  BudgetVersion,
  canAccessModule,
  GeneralLedgerApiService,
  PermissionsService,
  SpendRule,
  TranslateService,
} from '@core';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { BudgetingAuditComponent } from './budgeting-audit.component';
import { BudgetingBarsComponent } from './budgeting-bars.component';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { BudgetingGridComponent } from './budgeting-grid.component';
import { BudgetingOverridesComponent } from './budgeting-overrides.component';
import { BudgetingSpendControlComponent } from './budgeting-spend-control.component';
import { BudgetingSpendRulesComponent } from './budgeting-spend-rules.component';
import { BudgetingVarianceComponent } from './budgeting-variance.component';
import { BudgetingVersionDetailComponent } from './budgeting-version-detail.component';
import { BudgetingVersionToolsComponent } from './budgeting-version-tools.component';
import { BudgetingVolumePriceComponent } from './budgeting-volume-price.component';
import { BUDGETING_ROUTES } from './budgeting.routes';
import { barWidth, canRejectVersion, enumKey, monthOf, OPTIONAL_UUID_PATTERN, OVERRIDE_STATUS_COLORS, SPEND_OUTCOME_COLORS, TRAFFIC_LIGHT_COLORS } from './budgeting.util';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';

const version: BudgetVersion = {
  id: 'bv-1',
  name: 'Budget 2028',
  description: null,
  fiscal_year: 2028,
  year_start: '2028-01-01',
  version_type: 'budget',
  granularity: 'monthly',
  status: 'approved',
  currency: 'EUR',
  base_version_id: null,
  reforecast_from_period: null,
  seasonal_weights: null,
  submitted_by: null,
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  locked_by: null,
  locked_at: null,
};

const grid: BudgetGrid = {
  version_id: 'bv-1',
  granularity: 'monthly',
  slots: [
    { slot: 1, label: '2028-01', from_period: 1, to_period: 1 },
    { slot: 2, label: '2028-02', from_period: 2, to_period: 2 },
  ],
  rows: [
    {
      key: 'row-1',
      account_id: ACCOUNT,
      account_code: '6100',
      account_name: 'Rent',
      cost_center_id: null,
      cost_center_code: null,
      cost_center_name: null,
      project_id: null,
      project_code: null,
      project_name: null,
      cells: { '1': { amount: '100.00', quantity: '10.000', unit_price: '10.0000' } },
      total: '100.00',
    },
  ],
  totals: { total: '100.00', slots: { '1': '100.00' } },
};

const override: BudgetOverride = {
  id: 'ov-1',
  scope: 'document',
  source_type: 'purchase_order',
  source_id: 'po-1',
  source_number: 'PO-1',
  account_id: null,
  cost_center_id: null,
  project_id: null,
  fiscal_year: 2028,
  requested_amount: '500.00',
  shortfall_amount: '300.00',
  approved_amount: null,
  consumed_amount: '0.00',
  remaining_amount: '0.00',
  reason: 'Urgent repair',
  status: 'pending',
  is_expired: false,
  requested_by: 'u-1',
  decided_by: null,
  decided_at: null,
  decision_comment: null,
  valid_until: null,
  created_at: '2028-02-01T10:00:00Z',
};

const rule: SpendRule = {
  id: 'r-1',
  name: 'Block IT',
  account_id: null,
  cost_center_id: 'cc-1',
  project_id: null,
  mode: 'hard_block',
  threshold_percent: '100.00',
  document_types: ['purchase_order'],
  stages: ['approve'],
  enforce_without_budget: false,
  priority: 1,
  is_active: true,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const accountingSpy = { getAccounts: vi.fn() };
const ledgerSpy = { getCostCenters: vi.fn() };
const permissions = { canWrite: vi.fn().mockReturnValue(true), canRead: vi.fn().mockReturnValue(true) };

function configure(api: Record<string, unknown>): void {
  accountingSpy.getAccounts.mockReturnValue(of({ data: [{ id: ACCOUNT, account_code: '6100', name: 'Rent' }] }));
  ledgerSpy.getCostCenters.mockReturnValue(of({ data: [{ id: 'cc-1', code: 'CC1', name: 'Sales', is_active: true }] }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BudgetingApiService, useValue: api },
      { provide: AccountingApiService, useValue: accountingSpy },
      { provide: GeneralLedgerApiService, useValue: ledgerSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      { provide: PermissionsService, useValue: permissions },
      provideNzIcons(icons),
    ],
  });
}

describe('budget control util', () => {
  it('builds the key of an enum value', () => {
    expect(enumKey('BUDGETING_CONTROL.MODE', 'hard_block')).toBe('BUDGETING_CONTROL.MODE_HARD_BLOCK');
  });

  it('never lets a formal budget be rejected once approved', () => {
    expect(canRejectVersion('submitted', true)).toBe(true);
    expect(canRejectVersion('approved', true)).toBe(false);
    expect(canRejectVersion('approved', false)).toBe(true);
    expect(canRejectVersion('locked', false)).toBe(false);
    expect(canRejectVersion('draft', false)).toBe(false);
  });

  it('sizes the bars against the largest amount', () => {
    expect(barWidth('50', 100)).toBe(50);
    expect(barWidth('0', 100)).toBe(0);
    expect(barWidth('0.1', 1000)).toBe(1);
    expect(barWidth('500', 100)).toBe(100);
    expect(barWidth('10', 0)).toBe(0);
  });

  it('reads the month of a date and validates optional uuids', () => {
    expect(monthOf('2028-03-15')).toBe('2028-03');
    expect(monthOf('x')).toBeNull();
    expect(OPTIONAL_UUID_PATTERN.test('')).toBe(true);
    expect(OPTIONAL_UUID_PATTERN.test(PROJECT)).toBe(true);
    expect(OPTIONAL_UUID_PATTERN.test('abc')).toBe(false);
  });

  it('has a colour for every light, outcome and override status', () => {
    expect(Object.keys(TRAFFIC_LIGHT_COLORS)).toEqual(['green', 'amber', 'red']);
    expect(SPEND_OUTCOME_COLORS['blocked']).toBe('red');
    expect(OVERRIDE_STATUS_COLORS['approved']).toBe('green');
  });
});

describe('budget control access and navigation', () => {
  it('reserves the rules to finance and the override decision to owners and administrators', () => {
    expect(canAccessModule('budgeting_control', 'write', ['accountant'])).toBe(true);
    expect(canAccessModule('budgeting_control', 'write', ['member'])).toBe(false);
    expect(canAccessModule('budgeting_control', 'write', ['member'], ['budgeting.control.manage'])).toBe(true);
    expect(canAccessModule('budgeting_control', 'read', ['member'])).toBe(true);
    expect(canAccessModule('budgeting_override', 'write', ['admin'])).toBe(true);
    expect(canAccessModule('budgeting_override', 'write', ['accountant'])).toBe(false);
    expect(canAccessModule('budgeting_override', 'write', ['member'], ['budgeting.override.approve'])).toBe(true);
  });

  it('adds the spend control and overrides pages to the menu and the routes', () => {
    const group = MENU_SECTIONS.flatMap((section) => section.items).find((item) => item.key === 'NAV.BUDGETING');
    expect(group?.children?.map((child) => child.route)).toEqual(['/budgeting', '/budgeting/versions', '/budgeting/spend-control', '/budgeting/overrides']);
    expect(BUDGETING_ROUTES.map((route) => route.path)).toEqual(['', 'versions', 'spend-control', 'overrides', 'versions/:id']);
  });
});

describe('BudgetingBarsComponent', () => {
  it('scales the bars against the largest amount', () => {
    configure({});
    const fixture = TestBed.createComponent(BudgetingBarsComponent);
    fixture.componentRef.setInput('groups', [{ label: 'Rent', budget: '100', actual: '200', favorable: false }]);
    fixture.detectChanges();

    expect(fixture.componentInstance.max()).toBe(200);
    expect(fixture.componentInstance.width('100')).toBe(50);
  });
});

describe('BudgetingDimensionsComponent', () => {
  it('offers the accounts and the cost centres of the ledger', () => {
    configure({});
    const fixture = TestBed.createComponent(BudgetingDimensionsComponent);
    fixture.componentRef.setInput('group', new FormGroup({ account_id: new FormControl(null), cost_center_id: new FormControl(null), project_id: new FormControl('') }));
    fixture.detectChanges();

    expect(fixture.componentInstance.accounts()).toEqual([{ id: ACCOUNT, label: '6100 Rent' }]);
    expect(fixture.componentInstance.costCenters()).toEqual([{ id: 'cc-1', label: 'CC1 Sales' }]);
  });
});

describe('BudgetingGridComponent', () => {
  const api = { getGrid: vi.fn(), saveGrid: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getGrid.mockReturnValue(of({ data: grid }));
    api.saveGrid.mockReturnValue(of({ data: { saved: 1 } }));
    configure(api);
  });

  it('loads the grid and shows the edited value before the saved one', () => {
    const fixture = TestBed.createComponent(BudgetingGridComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getGrid).toHaveBeenCalledWith('bv-1');
    expect(component.value(grid.rows[0], 1, 'amount')).toBe('100.00');
    expect(component.value(grid.rows[0], 2, 'amount')).toBe('0.00');
    component.edit(grid.rows[0], 2, 'amount', 250);
    expect(component.value(grid.rows[0], 2, 'amount')).toBe('250');
    expect(component.dirtyCount()).toBe(1);
  });

  it('saves only the edited cells with the API field names and tells the parent', () => {
    const fixture = TestBed.createComponent(BudgetingGridComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const changed = vi.fn();
    component.changed.subscribe(changed);

    component.edit(grid.rows[0], 1, 'amount', 120);
    component.edit(grid.rows[0], 1, 'quantity', 12);
    component.save();

    expect(api.saveGrid).toHaveBeenCalledWith('bv-1', [{ account_id: ACCOUNT, cost_center_id: null, project_id: null, slot: 1, amount: '120', quantity: '12', unit_price: '10.0000' }]);
    expect(changed).toHaveBeenCalled();
  });

  it('does not call the API without edits and shows the API reason of a refusal', () => {
    const fixture = TestBed.createComponent(BudgetingGridComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.save();
    expect(api.saveGrid).not.toHaveBeenCalled();

    api.saveGrid.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { cells: ['Only a draft can be edited.'] } } })));
    component.edit(grid.rows[0], 1, 'amount', 1);
    component.save();
    expect(messageSpy.error).toHaveBeenCalledWith('Only a draft can be edited.');
  });

  it('adds a row for another dimension combination', () => {
    const fixture = TestBed.createComponent(BudgetingGridComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRow();
    component.rowForm.patchValue({ account_id: ACCOUNT, cost_center_id: 'cc-1' });
    component.addRow();
    expect(component.rows()).toHaveLength(2);
    expect(component.rows()[1].cost_center_id).toBe('cc-1');
  });
});

describe('BudgetingVersionToolsComponent', () => {
  const api = {
    reviseVersion: vi.fn(),
    createScenario: vi.fn(),
    rollForward: vi.fn(),
    transferBudget: vi.fn(),
    importBudget: vi.fn(),
    downloadImportTemplate: vi.fn(),
    downloadExecutivePack: vi.fn(),
  };

  function create(current: BudgetVersion) {
    const fixture = TestBed.createComponent(BudgetingVersionToolsComponent);
    fixture.componentRef.setInput('version', current);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.reviseVersion.mockReturnValue(of({ data: { ...version, id: 'rev-1' } }));
    api.createScenario.mockReturnValue(of({ data: { ...version, id: 'sc-1' } }));
    api.rollForward.mockReturnValue(of({ data: { ...version, id: 'rf-1' } }));
    api.transferBudget.mockReturnValue(of(undefined));
    api.importBudget.mockReturnValue(of({ data: { id: 'im-1', status: 'imported', total_rows: 2, imported_rows: 2, error_rows: 0, errors: [] } }));
    api.downloadImportTemplate.mockReturnValue(of(new Blob(['x'])));
    api.downloadExecutivePack.mockReturnValue(of(new Blob(['x'])));
    configure(api);
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('offers a revision only for an approved formal budget and a roll forward only for a rolling forecast', () => {
    expect(create(version).canRevise()).toBe(true);
    expect(create({ ...version, status: 'draft' }).canRevise()).toBe(false);
    expect(create({ ...version, version_type: 'forecast' }).canRevise()).toBe(false);
    expect(create({ ...version, version_type: 'rolling_forecast' }).canRoll()).toBe(true);
    expect(create(version).canRoll()).toBe(false);
  });

  it('revises with the mandatory reason and opens the new version', () => {
    const component = create(version);
    const created = vi.fn();
    component.created.subscribe(created);

    component.open('revise');
    expect(component.invalid()).toBe(true);
    component.reviseForm.patchValue({ reason: 'Mid-year revision' });
    expect(component.invalid()).toBe(false);
    component.run();

    expect(api.reviseVersion).toHaveBeenCalledWith('bv-1', { name: null, reason: 'Mid-year revision' });
    expect(created).toHaveBeenCalledWith('rev-1');
  });

  it('creates a scenario and rolls a forecast forward', () => {
    const component = create(version);
    const created = vi.fn();
    component.created.subscribe(created);

    component.open('scenario');
    component.scenarioForm.patchValue({ name: 'Worst', scenario_kind: 'worst_case', adjustment_percent: 10 });
    component.run();
    expect(api.createScenario).toHaveBeenCalledWith('bv-1', { name: 'Worst', scenario_kind: 'worst_case', adjustment_percent: 10 });
    expect(created).toHaveBeenLastCalledWith('sc-1');

    component.open('roll');
    component.rollForm.patchValue({ shift_months: 3 });
    component.run();
    expect(api.rollForward).toHaveBeenCalledWith('bv-1', { name: null, shift_months: 3, adjustment_percent: null });
    expect(created).toHaveBeenLastCalledWith('rf-1');
  });

  it('transfers an amount between two lines', () => {
    const component = create({ ...version, status: 'draft' });
    const changed = vi.fn();
    component.changed.subscribe(changed);

    component.open('transfer');
    component.transferForm.patchValue({ from: { account_id: ACCOUNT }, to: { account_id: '33333333-3333-4333-8333-333333333333' }, period: 2, amount: 50 });
    component.run();

    expect(api.transferBudget).toHaveBeenCalledWith('bv-1', {
      from: { account_id: ACCOUNT, cost_center_id: null, project_id: null },
      to: { account_id: '33333333-3333-4333-8333-333333333333', cost_center_id: null, project_id: null },
      period: 2,
      amount: '50',
      comment: null,
    });
    expect(changed).toHaveBeenCalled();
  });

  it('validates a file first and imports it, showing the row errors of a refused file', () => {
    const component = create({ ...version, status: 'draft' });
    const file = new File(['x'], 'budget.xlsx');

    component.open('import');
    expect(component.invalid()).toBe(true);
    component.file.set(file);
    component.importMode.set('replace');
    component.runImport(true);
    expect(api.importBudget).toHaveBeenCalledWith('bv-1', file, 'replace', true);

    api.importBudget.mockReturnValue(of({ data: { id: 'im-2', status: 'failed', total_rows: 1, imported_rows: 0, error_rows: 1, errors: [{ row: 2, field: 'account_code', message: 'Unknown account' }] } }));
    component.runImport(false);
    expect(component.importResult()?.errors[0].row).toBe(2);
    expect(component.visible()).toBe(true);
  });

  it('downloads the template and the executive pack', () => {
    const component = create(version);
    component.downloadTemplate();
    component.downloadPack();

    expect(api.downloadImportTemplate).toHaveBeenCalledWith('bv-1');
    expect(api.downloadExecutivePack).toHaveBeenCalledWith('bv-1');
  });
});

describe('BudgetingVarianceComponent filters and traffic light', () => {
  const api = { getVariance: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVariance.mockReturnValue(
      of({
        data: {
          version_id: 'bv-1',
          through_period: 12,
          group_by: 'account',
          thresholds: { amber: '5.00', red: '10.00' },
          rows: [{ key: 'a', label: 'Rent', code: '6100', budget: '100.00', actual: '120.00', variance: '20.00', variance_percent: '20.0', is_favorable: false, status: 'over', traffic_light: 'red' }],
          totals: { budget: '100.00', actual: '120.00', variance: '20.00', variance_percent: '20.0', adverse: '20.00', favorable: '0.00' },
        },
      }),
    );
    configure(api);
  });

  it('sends the dimension filters and draws a bar per row', () => {
    const fixture = TestBed.createComponent(BudgetingVarianceComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.bars()).toEqual([{ label: '6100 Rent', budget: '100.00', actual: '120.00', favorable: false }]);
    expect(component.lightColor('amber')).toBe('orange');

    component.filterForm.patchValue({ cost_center_id: 'cc-1', project_id: PROJECT });
    component.applyFilters();
    expect(api.getVariance).toHaveBeenLastCalledWith('bv-1', 12, 'account', { account_id: null, cost_center_id: 'cc-1', project_id: PROJECT });

    component.clearFilters();
    expect(api.getVariance).toHaveBeenLastCalledWith('bv-1', 12, 'account', {});
  });

  it('refuses a project that is not a uuid', () => {
    const fixture = TestBed.createComponent(BudgetingVarianceComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    fixture.componentInstance.filterForm.patchValue({ project_id: 'nope' });
    expect(fixture.componentInstance.filterForm.invalid).toBe(true);
  });
});

describe('BudgetingVolumePriceComponent', () => {
  const api = { getDecomposition: vi.fn(), getActualVolumes: vi.fn(), saveActualVolume: vi.fn(), deleteActualVolume: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDecomposition.mockReturnValue(of({ data: { version_id: 'bv-1', through_period: 12, group_by: 'account', rows: [], totals: { budget: '0', actual: '0', variance: '0', volume_variance: '0', price_variance: '0', undecomposed_variance: '0' } } }));
    api.getActualVolumes.mockReturnValue(of({ data: [{ id: 'av-1', account_id: ACCOUNT, cost_center_id: null, project_id: null, month: '2028-01', quantity: '10.000', notes: null }] }));
    api.saveActualVolume.mockReturnValue(of({ data: {} }));
    api.deleteActualVolume.mockReturnValue(of(undefined));
    configure(api);
  });

  it('loads the decomposition and the actual volumes and reloads for another grouping', () => {
    const fixture = TestBed.createComponent(BudgetingVolumePriceComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getDecomposition).toHaveBeenCalledWith('bv-1', 12, 'account');
    expect(component.volumes()).toHaveLength(1);
    component.groupBy.set('project');
    component.load();
    expect(api.getDecomposition).toHaveBeenLastCalledWith('bv-1', 12, 'project');
  });

  it('records and removes an actual quantity', () => {
    const fixture = TestBed.createComponent(BudgetingVolumePriceComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openVolume();
    expect(component.volumeForm.invalid).toBe(true);
    component.volumeForm.patchValue({ account_id: ACCOUNT, month: '2028-02', quantity: 7.5 });
    component.saveVolume();
    expect(api.saveActualVolume).toHaveBeenCalledWith({ account_id: ACCOUNT, cost_center_id: null, project_id: null, month: '2028-02', quantity: '7.5' });

    component.removeVolume(component.volumes()[0]);
    expect(api.deleteActualVolume).toHaveBeenCalledWith('av-1');
  });
});

describe('BudgetingAuditComponent', () => {
  it('loads the audit trail and the import history', () => {
    const api = { getVersionAudit: vi.fn().mockReturnValue(of({ data: [{ id: 'e1', action: 'revise' }] })), getImports: vi.fn().mockReturnValue(of({ data: [{ id: 'i1' }] })) };
    configure(api);
    const fixture = TestBed.createComponent(BudgetingAuditComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    expect(api.getVersionAudit).toHaveBeenCalledWith('bv-1');
    expect(fixture.componentInstance.events()).toHaveLength(1);
    expect(fixture.componentInstance.imports()).toHaveLength(1);
  });
});

describe('BudgetingSpendControlComponent', () => {
  const api = {
    getAvailability: vi.fn(),
    checkSpend: vi.fn(),
    getCommitments: vi.fn(),
    getSpendChecks: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getRules: vi.fn(),
  };
  const availability = { version_id: 'bv-1', fiscal_year: 2028, has_budget: true, currency: 'EUR', budget: '1000.00', actual: '400.00', committed: '700.00', available: '-100.00', utilization_percent: '110.00' };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAvailability.mockReturnValue(of({ data: availability }));
    api.checkSpend.mockReturnValue(of({ data: { outcome: 'blocked', mode: 'hard_block', rule_id: 'r-1', override_id: null, check_id: null, requested: '50.00', shortfall: '150.00', availability } }));
    api.getCommitments.mockReturnValue(of({ data: [] }));
    api.getSpendChecks.mockReturnValue(of({ data: [] }));
    api.getSettings.mockReturnValue(of({ data: { amber_threshold_percent: '5.00', red_threshold_percent: '10.00', override_validity_days: 30 } }));
    api.updateSettings.mockReturnValue(of({ data: { amber_threshold_percent: '6.00', red_threshold_percent: '12.00', override_validity_days: 15 } }));
    api.getRules.mockReturnValue(of({ data: [rule] }));
    configure(api);
  });

  it('loads the availability, the commitments, the controls and the settings', () => {
    const fixture = TestBed.createComponent(BudgetingSpendControlComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getAvailability).toHaveBeenCalledWith({ account_id: null, cost_center_id: null, project_id: null, date: null });
    expect(api.getCommitments).toHaveBeenCalledWith({ status: 'open', per_page: 100 });
    expect(component.progress(availability)).toBe(100);
    expect(component.isNegative(availability.available)).toBe(true);
    expect(component.settingsForm.getRawValue().red_threshold_percent).toBe(10);
  });

  it('checks a what-if spend with the API field names', () => {
    const fixture = TestBed.createComponent(BudgetingSpendControlComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.checkForm.patchValue({ source_type: 'requisition', stage: 'approve', amount: 50, cost_center_id: 'cc-1' });
    component.runCheck();

    expect(api.checkSpend).toHaveBeenCalledWith({ source_type: 'requisition', stage: 'approve', amount: '50', account_id: null, cost_center_id: 'cc-1', project_id: null });
    expect(component.decision()?.outcome).toBe('blocked');
    expect(component.outcomeColor('blocked')).toBe('red');
  });

  it('saves the thresholds and shows the API reason of a refusal', () => {
    const fixture = TestBed.createComponent(BudgetingSpendControlComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.settingsForm.patchValue({ amber_threshold_percent: 6, red_threshold_percent: 12, override_validity_days: 15 });
    component.saveSettings();
    expect(api.updateSettings).toHaveBeenCalledWith({ amber_threshold_percent: 6, red_threshold_percent: 12, override_validity_days: 15 });
    expect(component.settingsForm.getRawValue().override_validity_days).toBe(15);

    api.updateSettings.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { amber_threshold_percent: ['Amber cannot exceed red.'] } } })));
    component.saveSettings();
    expect(messageSpy.error).toHaveBeenCalledWith('Amber cannot exceed red.');
  });
});

describe('BudgetingSpendRulesComponent', () => {
  const api = { getRules: vi.fn(), createRule: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getRules.mockReturnValue(of({ data: [rule] }));
    api.createRule.mockReturnValue(of({ data: rule }));
    api.updateRule.mockReturnValue(of({ data: rule }));
    api.deleteRule.mockReturnValue(of(undefined));
    configure(api);
  });

  it('creates a rule with the API field names', () => {
    const fixture = TestBed.createComponent(BudgetingSpendRulesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ name: 'Warn all', mode: 'warning', threshold_percent: 90, cost_center_id: 'cc-1' });
    component.save();

    expect(api.createRule).toHaveBeenCalledWith({
      name: 'Warn all',
      account_id: null,
      cost_center_id: 'cc-1',
      project_id: null,
      mode: 'warning',
      threshold_percent: 90,
      document_types: ['requisition', 'purchase_order'],
      stages: ['submit', 'approve'],
      enforce_without_budget: false,
      priority: 0,
      is_active: true,
    });
  });

  it('fills the form from an existing rule, updates it and deletes it', () => {
    const fixture = TestBed.createComponent(BudgetingSpendRulesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal(rule);
    expect(component.form.getRawValue().mode).toBe('hard_block');
    expect(component.form.getRawValue().threshold_percent).toBe(100);
    component.save();
    expect(api.updateRule).toHaveBeenCalledWith('r-1', expect.objectContaining({ name: 'Block IT', stages: ['approve'] }));

    component.remove(rule);
    expect(api.deleteRule).toHaveBeenCalledWith('r-1');
  });

  it('needs at least one document type and stage', () => {
    const fixture = TestBed.createComponent(BudgetingSpendRulesComponent);
    fixture.detectChanges();
    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ name: 'x', document_types: [] });
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });
});

describe('BudgetingOverridesComponent', () => {
  const api = {
    getOverrides: vi.fn(),
    requestOverride: vi.fn(),
    approveOverride: vi.fn(),
    rejectOverride: vi.fn(),
    cancelOverride: vi.fn(),
    getOverrideHistory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    permissions.canWrite.mockReturnValue(true);
    api.getOverrides.mockReturnValue(of({ data: [override] }));
    api.requestOverride.mockReturnValue(of({ data: override }));
    api.approveOverride.mockReturnValue(of({ data: override }));
    api.rejectOverride.mockReturnValue(of({ data: override }));
    api.cancelOverride.mockReturnValue(of({ data: override }));
    api.getOverrideHistory.mockReturnValue(of({ data: [{ id: 'e1', action: 'request', comment: null, created_at: '2028-02-01' }] }));
    configure(api);
  });

  it('lists the requests and filters them by status', () => {
    const fixture = TestBed.createComponent(BudgetingOverridesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getOverrides).toHaveBeenCalledWith({ status: undefined, per_page: 100 });
    component.status.set('pending');
    component.load();
    expect(api.getOverrides).toHaveBeenLastCalledWith({ status: 'pending', per_page: 100 });
    expect(component.canDecide).toBe(true);
    expect(component.statusColor('approved')).toBe('green');
  });

  it('requests an override for a document with the API field names', () => {
    const fixture = TestBed.createComponent(BudgetingOverridesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRequest();
    expect(component.requestForm.invalid).toBe(true);
    component.requestForm.patchValue({ source_id: PROJECT, source_number: 'PO-7', cost_center_id: 'cc-1', requested_amount: 500, reason: 'Urgent repair' });
    component.saveRequest();

    expect(api.requestOverride).toHaveBeenCalledWith({
      scope: 'document',
      source_type: 'purchase_order',
      source_id: PROJECT,
      source_number: 'PO-7',
      account_id: null,
      cost_center_id: 'cc-1',
      project_id: null,
      requested_amount: '500',
      reason: 'Urgent repair',
      valid_until: null,
    });
  });

  it('sends no document for an allowance request', () => {
    const fixture = TestBed.createComponent(BudgetingOverridesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRequest();
    component.requestForm.patchValue({ scope: 'allowance', cost_center_id: 'cc-1', requested_amount: 100, reason: 'Quarter end', valid_until: '2028-03-31' });
    component.saveRequest();

    expect(api.requestOverride).toHaveBeenCalledWith(expect.objectContaining({ scope: 'allowance', source_type: null, source_id: null, valid_until: '2028-03-31' }));
  });

  it('approves with a lower amount, rejects with a comment and cancels', () => {
    const fixture = TestBed.createComponent(BudgetingOverridesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDecision(override, 'approve');
    component.decisionForm.patchValue({ comment: 'Ok', approved_amount: 250, valid_until: '2028-03-31' });
    component.saveDecision();
    expect(api.approveOverride).toHaveBeenCalledWith('ov-1', { comment: 'Ok', approved_amount: '250', valid_until: '2028-03-31' });

    component.openDecision(override, 'reject');
    component.decisionForm.patchValue({ comment: 'Not now' });
    component.saveDecision();
    expect(api.rejectOverride).toHaveBeenCalledWith('ov-1', { comment: 'Not now' });

    component.openDecision(override, 'cancel');
    component.saveDecision();
    expect(api.cancelOverride).toHaveBeenCalledWith('ov-1', { comment: null });
  });

  it('shows the API reason of a refused decision and loads the history', () => {
    const fixture = TestBed.createComponent(BudgetingOverridesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    api.approveOverride.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { status: ['The requester cannot approve their own request.'] } } })));
    component.openDecision(override, 'approve');
    component.saveDecision();
    expect(messageSpy.error).toHaveBeenCalledWith('The requester cannot approve their own request.');

    component.openHistory(override);
    expect(api.getOverrideHistory).toHaveBeenCalledWith('ov-1');
    expect(component.history()).toHaveLength(1);
  });

  it('does not offer the decision to members without the right', () => {
    permissions.canWrite.mockReturnValue(false);
    const fixture = TestBed.createComponent(BudgetingOverridesComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.canDecide).toBe(false);
  });
});

describe('BudgetingVersionDetailComponent navigation to a created version', () => {
  it('navigates to the version a revision created', () => {
    const api = { getVersion: vi.fn().mockReturnValue(of({ data: version })), getGrid: vi.fn().mockReturnValue(of({ data: grid })), getVersionAudit: vi.fn(), getImports: vi.fn() };
    configure(api);
    TestBed.configureTestingModule({ providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'bv-1' }) } } }] });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BudgetingVersionDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.openCreated('rev-1');
    expect(navigate).toHaveBeenCalledWith(['/budgeting/versions', 'rev-1']);
    expect(api.getVersion).toHaveBeenLastCalledWith('rev-1');
    expect(fixture.componentInstance.canReject()).toBe(false);
  });
});
