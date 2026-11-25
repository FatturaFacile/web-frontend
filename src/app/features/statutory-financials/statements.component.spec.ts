import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatementsComponent } from './statements.component';
import { baseProviders, dossier, lookups, wrap } from './statutory-financials.testing';
import { WorkspaceStore } from './workspace.store';

describe('StatementsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      generate: vi.fn(() => of(wrap(dossier('d-1', { status: 'reclassified' })))),
      generateCashFlow: vi.fn(() => of(wrap(dossier('d-1')))),
    };
    TestBed.configureTestingModule({
      providers: [WorkspaceStore, ...baseProviders(api, () => canWrite)],
    });
  });

  async function render(extra: Parameters<typeof dossier>[1] = {}) {
    api['getDossier']?.mockReturnValue(of(wrap(dossier('d-1', extra))));
    await TestBed.inject(WorkspaceStore).load('d-1');
    const fixture = TestBed.createComponent(StatementsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state and a generate button before the statements exist', async () => {
    const fixture = await render({ has_statements: false });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('statutoryFinancials.empty.statements');
    expect(root.textContent).toContain('statutoryFinancials.action.generate');
    expect(root.querySelector('app-sf-statement-table')).toBeNull();
  });

  it('shows the balance sheet from the lines with the rounding line highlighted', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Total assets');
    expect(root.textContent).toContain('Fixed assets');
    const rounded = root.querySelector('tr.rounding-row') as HTMLElement;
    expect(rounded.textContent).toContain('Arrotondamenti attivi');
    expect(rounded.textContent).toContain('statutoryFinancials.statement.roundingTag');
    expect(root.textContent).toContain('statutoryFinancials.action.regenerate');
  });

  it('shows the rounding quadrature with the label of the reserve line', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('statutoryFinancials.section.quadrature');
    expect(text).toContain('Arrotondamenti attivi');
    expect(text).toContain('statutoryFinancials.quadrature.balanceSheetResidual');
  });

  it('lists the bifront accounts with the side tag from the seeded labels, the unmapped ones and the warnings', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent as string;

    expect(text).toContain('1100');
    expect(text).toContain('Customers');
    expect(text).toContain('Passivo');
    expect(text).toContain('9999');
    expect(text).toContain('Suspense');
    expect(text).toContain('Account 1100 sits on the opposite side.');
  });

  it('shows the profit allocation proposal', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('art. 2430 c.c.');
    expect(text).toContain('statutoryFinancials.allocation.capReached');
    expect(text).toContain('Legal reserve cap reached.');
  });

  it('shows the hidden reserves result of a Swiss dossier', async () => {
    const fixture = await render({
      accounting_standard: 'CH_SwissGaapFer',
      hidden_reserves_config: {
        enabled: true,
        result: {
          enabled: true,
          items: [
            {
              label: 'Stock',
              book_value: '100.0000',
              fer_value: '160.0000',
              hidden_reserve: '60.0000',
            },
          ],
          total_hidden_reserves: '60.0000',
          deferred_tax_on_reserves: '7.5000',
          statutory_view: { equity: '1000.0000', profit: '100.0000' },
          fer_view: { equity: '1052.5000', profit: '152.5000' },
          net_release: '0.0000',
          anhang_disclosure_required: true,
          warnings: [],
        },
      },
    });
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('statutoryFinancials.section.hiddenReserves');
    // The fixture is rounded to whole francs (quadrature scale 0), so the FER equity shows without cents.
    expect(text).toContain("1'053");
    expect(text).toContain('statutoryFinancials.hidden.required');
  });

  it('regenerates the statements and sends the cash flow method', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('.toolbar button')) as HTMLButtonElement[];

    buttons[0]?.click();
    await fixture.whenStable();
    expect(api['generate']).toHaveBeenCalledWith('d-1');

    buttons[1]?.click();
    await fixture.whenStable();
    expect(api['generateCashFlow']).toHaveBeenCalledWith('d-1', 'indirect');
  });

  it('is read-only when the dossier is locked', async () => {
    const fixture = await render({ status: 'locked' });
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.toolbar button'),
    ) as HTMLButtonElement[];

    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it('is read-only for a member who cannot write', async () => {
    canWrite = false;
    const fixture = await render();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.toolbar button'),
    ) as HTMLButtonElement[];

    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});
