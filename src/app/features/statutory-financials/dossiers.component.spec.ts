import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DossiersComponent } from './dossiers.component';
import { baseProviders, lookups, summary, wrap } from './statutory-financials.testing';

describe('DossiersComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listDossiers: vi.fn(),
      deleteDossier: vi.fn(() => of(wrap(null))),
    };
    api['listDossiers']?.mockImplementation(() =>
      of({
        ...wrap([
          summary('d-1', { status: 'validated', validation_status: 'valid' }),
          summary('d-2', {
            status: 'locked',
            accounting_standard: 'CH_CO_Art959',
            rounding_to_unit_mode: 'IntegerUnits_Euro_Chf',
            net_result: '1234567.5000',
            generated_at: '2026-02-01T10:00:00Z',
          }),
        ]),
        meta: { current_page: 1, per_page: 20, last_page: 1, total: 2 },
      }),
    );
    TestBed.configureTestingModule({ providers: baseProviders(api, () => canWrite) });
  });

  async function render() {
    const fixture = TestBed.createComponent(DossiersComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the dossiers with year, standard, status, validation, net result and generation date', async () => {
    const root = await render();
    const rows = Array.from(root.querySelectorAll('tbody tr.ant-table-row'));

    expect(api['listDossiers']).toHaveBeenCalledWith({ per_page: 20, page: 1 });
    expect(rows).toHaveLength(2);
    const first = rows[0]?.textContent as string;
    expect(first).toContain('Accounts d-1');
    expect(first).toContain('2025');
    expect(first).toContain('statutoryFinancials.standard.IT_OIC_Ordinario');
    expect(first).toContain('statutoryFinancials.status.validated');
    expect(first).toContain('statutoryFinancials.validation.valid');
    expect(first).toContain('12.345,67');

    const second = rows[1]?.textContent as string;
    expect(second).toContain("1'234'568");
    expect(second).toContain('2026-02-01');
  });

  it('offers deletion only for a dossier that is not locked or filed', async () => {
    const root = await render();
    const rows = Array.from(root.querySelectorAll('tbody tr.ant-table-row'));
    const hasDelete = (row: Element | undefined) =>
      (row?.textContent ?? '').includes('statutoryFinancials.action.delete');

    expect(hasDelete(rows[0])).toBe(true);
    expect(hasDelete(rows[1])).toBe(false);
  });

  it('hides creation and deletion from a member who cannot write', async () => {
    canWrite = false;
    const root = await render();

    expect(root.textContent).not.toContain('statutoryFinancials.action.newDossier');
    expect(root.textContent).not.toContain('statutoryFinancials.action.delete');
  });

  it('offers a New dossier link to the wizard', async () => {
    const root = await render();
    const link = Array.from(root.querySelectorAll('a')).find((anchor) =>
      (anchor.textContent ?? '').includes('statutoryFinancials.action.newDossier'),
    );

    expect(link?.getAttribute('href')).toBe('/statutory-financials/new');
  });

  it('filters by status, standard and fiscal year from the first page', async () => {
    const fixture = TestBed.createComponent(DossiersComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      store: { setFilters(patch: object): Promise<void> };
    };

    await component.store.setFilters({ status: 'draft', fiscal_year_id: 'fy-2025' });

    expect(api['listDossiers']).toHaveBeenLastCalledWith({
      per_page: 20,
      page: 1,
      status: 'draft',
      fiscal_year_id: 'fy-2025',
    });
  });
});
