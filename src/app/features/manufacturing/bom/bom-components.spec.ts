import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BomExplosion, ManufacturingApiService } from '@core';
import { icons } from '../../../icons-provider';
import { BomDesignerComponent } from './bom-designer.component';
import { BomDiffPageComponent } from './bom-diff.page';
import { BomDiffViewerComponent } from './bom-diff-viewer.component';
import { BomImportStore } from './bom-import.store';
import { BomImportWizardComponent } from './bom-import-wizard.component';
import { WhereUsedComponent } from './where-used.component';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const q = (f: ComponentFixture<unknown>, sel: string): HTMLElement | null =>
  (f.nativeElement as HTMLElement).querySelector(sel);
const all = (f: ComponentFixture<unknown>, sel: string): HTMLElement[] =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel));
const byId = (f: ComponentFixture<unknown>, id: string): HTMLElement | null => q(f, `[data-testid="${id}"]`);

async function settle(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

function setup(api: Record<string, unknown>, query: Record<string, string> = {}): void {
  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      { provide: ManufacturingApiService, useValue: { getBoms: () => ok([]), getMfgItems: () => ok([]), ...api } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
    ] as never,
  });
}

const EXPLOSION: BomExplosion = {
  total_lead_time_days: 7,
  lines: [
    {
      level: 1, item_id: 'i-a', item_code: 'SUB-A', item_name: 'Sub assembly', net_quantity: '1', variable_waste_quantity: '0',
      fixed_waste_quantity: '0', effective_quantity: '1', is_phantom: true, has_bom: true, path: ['SUB-A'],
    },
    {
      level: 2, item_id: 'i-s', item_code: 'SCREW', net_quantity: '4', variable_waste_quantity: '0', fixed_waste_quantity: '0',
      effective_quantity: '4', is_phantom: false, has_bom: false, unit_cost: '0.5', path: ['SUB-A', 'SCREW'],
    },
    {
      level: 1, item_id: 'i-p', item_code: 'PLATE', net_quantity: '2', variable_waste_quantity: '0', fixed_waste_quantity: '0',
      effective_quantity: '2', is_phantom: false, has_bom: false, unit_cost: '5', path: ['PLATE'],
    },
  ],
};

describe('BomDesignerComponent', () => {
  let fixture: ComponentFixture<BomDesignerComponent>;
  const api = {
    getBomExplosion: vi.fn(() => ok(EXPLOSION)),
    createBomRevision: vi.fn(() => of({ data: { id: 'b2' }, engineering_change: { id: 'e1', status: 'draft' } })),
    getBomPreferentialOrigin: vi.fn(() => ok({ qualifies: true, non_originating_percentage: '30', threshold_percentage: '40' })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    setup(api, { bom: 'bom-1' });
    fixture = TestBed.createComponent(BomDesignerComponent);
    await settle(fixture);
  });

  it('opens the BOM from the query string and renders the tree with phantom badge and cost rollup', () => {
    expect(api.getBomExplosion).toHaveBeenCalledWith('bom-1', expect.objectContaining({ multi_level: true }));
    expect(all(fixture, 'tbody tr').map((r) => r.dataset['testid'])).toEqual(['row-SUB-A', 'row-SCREW', 'row-PLATE']);
    expect(byId(fixture, 'row-SUB-A')?.querySelector('[data-testid="phantom-badge"]')).not.toBeNull();
    // 4 x 0.5 + 2 x 5
    expect(byId(fixture, 'stats')?.textContent).toContain('12.00');
  });

  it('collapses a level with the toggle', async () => {
    (byId(fixture, 'row-SUB-A')?.querySelector('button.toggle') as HTMLButtonElement).click();
    await settle(fixture);

    expect(all(fixture, 'tbody tr').map((r) => r.dataset['testid'])).toEqual(['row-SUB-A', 'row-PLATE']);
  });

  it('recomputes the cost while editing and saves the edits as an engineering change', async () => {
    const input = byId(fixture, 'row-PLATE')?.querySelector('input') as HTMLInputElement;
    input.value = '4';
    input.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(byId(fixture, 'stats')?.textContent).toContain('22.00');

    const reason = byId(fixture, 'reason') as HTMLInputElement;
    reason.value = 'Thicker plate';
    reason.dispatchEvent(new Event('input'));
    await settle(fixture);
    (byId(fixture, 'save-revision') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.createBomRevision).toHaveBeenCalledWith({
      source_bom_id: 'bom-1',
      reason: 'Thicker plate',
      components: [{ action: 'update', component_item_id: 'i-p', quantity_per: '4' }],
    });
  });

  it('disables the save while nothing was edited', () => {
    expect((byId(fixture, 'save-revision') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the EUR.1 result', async () => {
    (byId(fixture, 'check-origin') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.getBomPreferentialOrigin).toHaveBeenCalled();
    expect(byId(fixture, 'origin-result')?.textContent).toContain('MFG_BOM.EUR1_QUALIFIES');
  });
});

describe('WhereUsedComponent', () => {
  const api = {
    getItemImplosion: vi.fn(() =>
      ok({
        parents: [
          { level: 1, parent_item_code: 'SUB', cumulative_coefficient: '2', is_top_level: false, path: ['SUB'] },
          { level: 2, parent_item_code: 'TOP', cumulative_coefficient: '6', is_top_level: true, path: ['SUB', 'TOP'] },
        ],
        top_level: [],
      }),
    ),
    massReplaceComponent: vi.fn((payload: { dry_run: boolean }) =>
      ok({ replaced: [{ bom_number: 'BOM-1' }], skipped: payload.dry_run ? [] : [{ bom_number: 'BOM-2', reason: 'locked' }] }),
    ),
  };
  let fixture: ComponentFixture<WhereUsedComponent>;
  const comp = () => fixture.componentInstance as unknown as Record<string, { set(v: unknown): void }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setup(api);
    fixture = TestBed.createComponent(WhereUsedComponent);
    await settle(fixture);
  });

  it('shows the upward tree with the top-level products flagged', async () => {
    comp()['itemId'].set('item-1');
    await settle(fixture);
    (byId(fixture, 'analyze') as HTMLButtonElement).click();
    await settle(fixture);

    expect(all(fixture, 'tbody tr').length).toBeGreaterThanOrEqual(2);
    expect(byId(fixture, 'parent-TOP')?.textContent).toContain('MFG_BOM.TOP_LEVEL');
    expect(byId(fixture, 'parent-SUB')?.textContent).not.toContain('MFG_BOM.TOP_LEVEL');
  });

  it('only allows the replacement after a dry run of the same inputs', async () => {
    comp()['itemId'].set('item-1');
    await settle(fixture);
    (byId(fixture, 'analyze') as HTMLButtonElement).click();
    await settle(fixture);
    comp()['substituteId'].set('item-2');
    comp()['reason'].set('Obsolete');
    await settle(fixture);

    expect((byId(fixture, 'run-replace') as HTMLButtonElement).disabled).toBe(true);
    (byId(fixture, 'dry-run') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.massReplaceComponent).toHaveBeenLastCalledWith(expect.objectContaining({ dry_run: true, obsolete_item_id: 'item-1' }));
    expect((byId(fixture, 'run-replace') as HTMLButtonElement).disabled).toBe(false);

    comp()['reason'].set('Changed my mind');
    await settle(fixture);
    expect((byId(fixture, 'run-replace') as HTMLButtonElement).disabled).toBe(true);

    comp()['reason'].set('Obsolete');
    await settle(fixture);
    expect((byId(fixture, 'run-replace') as HTMLButtonElement).disabled).toBe(false);
    (byId(fixture, 'run-replace') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.massReplaceComponent).toHaveBeenLastCalledWith(expect.objectContaining({ dry_run: false }));
    expect(byId(fixture, 'replace-result')).not.toBeNull();
  });
});

describe('BomDiffViewerComponent', () => {
  let fixture: ComponentFixture<BomDiffViewerComponent>;
  const diff = {
    added: [{ item_code: 'NEW', quantity_per: '1' }],
    removed: [{ item_code: 'OLD', quantity_per: '2' }],
    modified: [{ item_code: 'MOD', changes: { quantity_per: { from: '1', to: '3' } } }],
  };

  beforeEach(async () => {
    setup({});
    fixture = TestBed.createComponent(BomDiffViewerComponent);
    fixture.componentRef.setInput('diff', diff);
    await settle(fixture);
  });

  it('lists added, removed and modified lines with from and to values (unified)', () => {
    const rows = all(fixture, '[data-testid="diff-row"]');

    expect(rows.map((r) => r.className)).toEqual(['added', 'removed', 'modified']);
    expect(rows[2].textContent).toContain('MOD');
    expect(rows[2].querySelector('.from')?.textContent).toBe('1');
    expect(rows[2].querySelector('.to')?.textContent).toBe('3');
    expect(byId(fixture, 'diff-counts')?.textContent).toContain('1');
  });

  it('switches to the side-by-side layout', async () => {
    fixture.componentRef.setInput('initialLayout', 'side-by-side');
    await settle(fixture);

    expect(byId(fixture, 'diff-side-by-side')).not.toBeNull();
    expect(byId(fixture, 'diff-unified')).toBeNull();
    const modified = all(fixture, '[data-testid="diff-row"]')[2].querySelectorAll('td');
    expect(modified[2].textContent).toBe('1');
    expect(modified[3].textContent).toBe('3');
  });

  it('shows an empty state without differences', async () => {
    fixture.componentRef.setInput('diff', { added: [], removed: [], modified: [] });
    await settle(fixture);

    expect(q(fixture, 'nz-empty')).not.toBeNull();
  });
});

describe('BomDiffPageComponent', () => {
  it('shows the diff_payload of the engineering change', async () => {
    setup(
      {
        getEngineeringChange: () =>
          ok({ id: 'e1', eco_number: 'ECO-1', status: 'draft', diff_payload: { added: [{ item_code: 'X' }], removed: [], modified: [] } }),
      },
      { eco: 'e1' },
    );
    const fixture = TestBed.createComponent(BomDiffPageComponent);
    await settle(fixture);

    expect(all(fixture, '[data-testid="diff-row"]')).toHaveLength(1);
  });

  it('reports a load error', async () => {
    setup({ getBomDiff: () => throwError(() => new Error('x')) }, { a: '1', b: '2' });
    const fixture = TestBed.createComponent(BomDiffPageComponent);
    await settle(fixture);

    expect(q(fixture, 'nz-alert')?.textContent).toContain('MFG_BOM.DIFF_LOAD_ERROR');
  });
});

describe('BomImportWizardComponent', () => {
  const CSV = 'Codice;Quantità;Scarto %\nBOLT;2,5;1\nNUT;4;\n';
  const report = (valid: boolean) => ({
    valid,
    rows: [
      { line: 1, status: 'ok', errors: [] },
      { line: 2, status: valid ? 'ok' : 'error', errors: valid ? [] : ['unknown item'] },
    ],
  });
  const csvFile = (): File => Object.assign(new File([CSV], 'bom.csv'), { text: async () => CSV });
  let fixture: ComponentFixture<BomImportWizardComponent>;
  let store: BomImportStore;
  const importBom = vi.fn();

  async function toCheckStep(): Promise<void> {
    await store.loadFile(csvFile());
    store.productCode.set('FG-1');
    store.go(2);
    await settle(fixture);
  }

  beforeEach(async () => {
    importBom.mockReset();
    setup({ importBom });
    fixture = TestBed.createComponent(BomImportWizardComponent);
    store = fixture.debugElement.injector.get(BomImportStore);
    await settle(fixture);
  });

  it('parses the file on the client and maps the columns by header', async () => {
    await store.loadFile(csvFile());
    await settle(fixture);

    expect(store.dataRows()).toHaveLength(2);
    expect(store.mapping().item_code).toBe(0);
    expect(store.mapping().quantity_per).toBe(1);
    expect(store.mapping().scrap_percentage).toBe(2);
    expect(store.payloadRows()[0]).toEqual({ item_code: 'BOLT', quantity_per: '2.5', scrap_percentage: '1' });
    expect(store.name()).toBe('bom');
    expect(byId(fixture, 'file-info')).not.toBeNull();
    expect(importBom).not.toHaveBeenCalled();
  });

  it('shows the per-row report of the dry run and enables the commit only when valid', async () => {
    importBom.mockReturnValue(ok(report(false)));
    await toCheckStep();
    (byId(fixture, 'dry-run') as HTMLButtonElement).click();
    await settle(fixture);

    expect(importBom).toHaveBeenCalledWith(expect.objectContaining({ dry_run: true, product_code: 'FG-1' }));
    expect(byId(fixture, 'report-row-2')?.textContent).toContain('unknown item');
    expect(store.canCommit()).toBe(false);

    importBom.mockReturnValue(ok(report(true)));
    store.dryRun().subscribe();
    await settle(fixture);
    expect(store.canCommit()).toBe(true);

    store.productCode.set('FG-2');
    expect(store.canCommit()).toBe(false);
  });

  it('creates the draft on commit and keeps the report when the server answers 422', async () => {
    importBom.mockReturnValue(ok(report(true)));
    await toCheckStep();
    store.dryRun().subscribe();
    importBom.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { data: report(false) } })));
    store.commit().subscribe();

    expect(store.committed()).toBe(false);
    expect(store.report()?.valid).toBe(false);

    importBom.mockReturnValue(ok({ id: 'bom-9' }));
    store.productCode.set('FG-1');
    store.report.set(report(true));
    store.commit().subscribe();
    expect(importBom).toHaveBeenLastCalledWith(expect.objectContaining({ dry_run: false }));
    expect(store.committed()).toBe(true);
  });

  it('flags a file that cannot be read', async () => {
    await store.loadFile(Object.assign(new File([''], 'x.csv'), { text: async () => Promise.reject(new Error('bad')) }));

    expect(store.parseError()).toBe(true);
  });
});
