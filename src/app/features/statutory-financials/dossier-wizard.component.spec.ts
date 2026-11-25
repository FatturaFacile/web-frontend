import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SfStandard } from '@core';
import { DossierWizardComponent } from './dossier-wizard.component';
import {
  baseProviders,
  dossier,
  eligibility,
  lookups,
  summary,
  wrap,
} from './statutory-financials.testing';
import { SfDossierDraft } from './statutory-financials.util';

interface WizardInternals {
  step(): number;
  draft(): SfDossierDraft;
  problem(): string | null;
  patch(patch: Partial<SfDossierDraft>): void;
  chooseStandard(standard: SfStandard): void;
  next(): Promise<void>;
  previous(): void;
  finish(): Promise<void>;
  switchToRecommended(): Promise<void>;
}

describe('DossierWizardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      createDossier: vi.fn(() => of(wrap(summary('d-new')))),
      updateDossier: vi.fn((id: string) =>
        of(wrap(summary(id, { accounting_standard: 'IT_OIC_Abbreviato' }))),
      ),
      getEligibility: vi.fn(() => of(wrap(eligibility()))),
    };
  });

  async function render(providers = baseProviders(api, () => true, null)) {
    TestBed.configureTestingModule({ providers });
    const fixture = TestBed.createComponent(DossierWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, wizard: fixture.componentInstance as unknown as WizardInternals };
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;

  it('blocks the first step until a fiscal year is chosen', async () => {
    const { fixture, wizard } = await render();

    await wizard.next();
    fixture.detectChanges();

    expect(wizard.step()).toBe(0);
    expect(wizard.problem()).toBe('fiscal_year_required');
    expect(root(fixture).textContent).toContain('statutoryFinancials.problem.fiscal_year_required');
    expect(api['createDossier']).not.toHaveBeenCalled();
  });

  it('refuses a comparative year equal to the fiscal year', async () => {
    const { wizard } = await render();

    wizard.patch({ fiscal_year_id: 'fy-2025', comparative_prior_year_id: 'fy-2025' });
    await wizard.next();

    expect(wizard.problem()).toBe('comparative_same');
    expect(wizard.step()).toBe(0);
  });

  it('requires a standard before it creates the dossier', async () => {
    const { wizard } = await render();
    wizard.patch({ fiscal_year_id: 'fy-2025' });
    await wizard.next();
    expect(wizard.step()).toBe(1);

    await wizard.next();

    expect(wizard.problem()).toBe('standard_required');
    expect(wizard.step()).toBe(1);
    expect(api['createDossier']).not.toHaveBeenCalled();
  });

  it('keeps only the income statement methods the chosen standard allows', async () => {
    const { fixture, wizard } = await render();
    wizard.patch({ fiscal_year_id: 'fy-2025', income_statement_method: 'cost_of_sales' });
    await wizard.next();

    wizard.chooseStandard('IT_OIC_Ordinario');
    fixture.detectChanges();

    expect(wizard.draft().income_statement_method).toBe('total_cost');
    expect(root(fixture).textContent).toContain('statutoryFinancials.incomeMethod.total_cost');
    expect(root(fixture).textContent).not.toContain(
      'statutoryFinancials.incomeMethod.cost_of_sales',
    );

    wizard.chooseStandard('CH_SwissGaapFer');
    wizard.patch({ income_statement_method: 'cost_of_sales' });
    fixture.detectChanges();

    expect(root(fixture).textContent).toContain('statutoryFinancials.section.cogsAllocation');
  });

  it('creates the dossier at the end of step 2 and shows the threshold check with its seeded message', async () => {
    const { fixture, wizard } = await render();
    wizard.patch({ fiscal_year_id: 'fy-2025', title: 'Accounts 2025' });
    await wizard.next();
    wizard.chooseStandard('IT_OIC_Ordinario');

    await wizard.next();
    fixture.detectChanges();

    expect(api['createDossier']).toHaveBeenCalledTimes(1);
    expect(api['createDossier']?.mock.calls[0]?.[0]).toMatchObject({
      fiscal_year_id: 'fy-2025',
      title: 'Accounts 2025',
      accounting_standard: 'IT_OIC_Ordinario',
      income_statement_method: 'total_cost',
    });
    expect(api['getEligibility']).toHaveBeenCalledWith('d-new', 'IT_OIC_Ordinario');
    expect(wizard.step()).toBe(2);

    const text = root(fixture).textContent as string;
    expect(text).toContain('Ordinary accounts recommended');
    expect(text).toContain('The thresholds were exceeded.');
    expect(text).toContain('Two of three limits exceeded.');
    expect(text).toContain('statutoryFinancials.eligibility.criterion.assets');
    expect(text).toContain('statutoryFinancials.action.switchToRecommended');
  });

  it('switches to the recommended standard with a PUT', async () => {
    const { fixture, wizard } = await render();
    wizard.patch({ fiscal_year_id: 'fy-2025' });
    await wizard.next();
    wizard.chooseStandard('IT_OIC_Ordinario');
    await wizard.next();

    await wizard.switchToRecommended();
    fixture.detectChanges();

    expect(api['updateDossier']).toHaveBeenCalledWith('d-new', {
      accounting_standard: 'IT_OIC_Abbreviato',
    });
    expect(wizard.draft().accounting_standard).toBe('IT_OIC_Abbreviato');
  });

  it('saves the options and opens the workspace of the new dossier', async () => {
    const { wizard, fixture } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    wizard.patch({ fiscal_year_id: 'fy-2025' });
    await wizard.next();
    wizard.chooseStandard('IT_OIC_Ordinario');
    await wizard.next();
    await wizard.next();
    expect(wizard.step()).toBe(3);

    wizard.patch({ share_capital: 10000, dividends: 500 });
    await wizard.finish();
    fixture.detectChanges();

    expect(api['updateDossier']).toHaveBeenLastCalledWith(
      'd-new',
      expect.objectContaining({ share_capital: 10000, dividends: 500 }),
    );
    expect(navigate).toHaveBeenCalledWith(['/statutory-financials', 'd-new']);
  });

  it('shows the hidden reserves options only for the Swiss standards', async () => {
    const { fixture, wizard } = await render();
    wizard.patch({ fiscal_year_id: 'fy-2025' });
    await wizard.next();
    wizard.chooseStandard('IT_OIC_Ordinario');
    await wizard.next();
    await wizard.next();
    fixture.detectChanges();
    expect(root(fixture).textContent).not.toContain('statutoryFinancials.section.hiddenReserves');

    wizard.chooseStandard('CH_SwissGaapFer');
    fixture.detectChanges();
    expect(root(fixture).textContent).toContain('statutoryFinancials.section.hiddenReserves');
  });

  it('prefills the settings of an existing dossier and updates it', async () => {
    const { wizard } = await render(baseProviders(api));

    expect(api['getDossier']).toHaveBeenCalledWith('d-1');
    expect(wizard.draft().fiscal_year_id).toBe('fy-2025');
    expect(wizard.draft().accounting_standard).toBe('IT_OIC_Ordinario');

    wizard.patch({ title: 'Renamed' });
    await wizard.next();
    await wizard.next();
    await wizard.next();
    await wizard.finish();

    expect(api['createDossier']).not.toHaveBeenCalled();
    expect(api['updateDossier']).toHaveBeenLastCalledWith(
      'd-1',
      expect.objectContaining({ title: 'Renamed' }),
    );
  });

  it('does not save a locked dossier', async () => {
    api['getDossier']?.mockReturnValue(of(wrap(dossier('d-1', { status: 'locked' }))));
    const { fixture, wizard } = await render(baseProviders(api));

    expect(root(fixture).textContent).toContain('statutoryFinancials.wizard.readOnly');
    await wizard.next();
    await wizard.next();
    await wizard.next();
    expect(api['updateDossier']).not.toHaveBeenCalled();
  });
});
