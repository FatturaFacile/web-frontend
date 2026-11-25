import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvConventionPayload } from '@core';
import { baseProviders, convention, lookups } from './corporate-conventions.testing';
import { ConventionFormComponent } from './convention-form.component';

interface FormInternals {
  form: {
    patchValue: (value: Record<string, unknown>) => void;
    controls: Record<string, { setValue: (value: unknown) => void }>;
  };
  rules: () => { priority: number; discount_percentage: number | string; rule_type: string }[];
  addRule: () => void;
  removeRule: (index: number) => void;
  move: (index: number, delta: -1 | 1) => void;
  updateRule: (index: number, patch: Record<string, unknown>) => void;
  canSubmit: () => boolean;
  problems: () => { row: number; code: string }[];
  payload: () => CcvConventionPayload;
  submit: () => void;
  pasted: { set: (value: string) => void };
  identifiers: () => string[];
  localPreview: () => { hint: string; sha256: string }[];
  previewHashes: () => Promise<void>;
  importList: () => void;
}

describe('ConventionFormComponent', () => {
  let fixture: ComponentFixture<ConventionFormComponent>;
  let internals: FormInternals;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: baseProviders({}) });
  });

  async function render(stored: ReturnType<typeof convention> | null = null): Promise<void> {
    fixture = TestBed.createComponent(ConventionFormComponent);
    fixture.componentRef.setInput('lookups', lookups);
    fixture.componentRef.setInput('convention', stored);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    internals = fixture.componentInstance as unknown as FormInternals;
  }

  function fill(): void {
    internals.form.patchValue({
      code: 'ACME',
      name: 'Acme employees',
      partner_company_name: 'Acme Srl',
      valid_from: '2028-01-01',
      allowed_email_domains: ['acme.it'],
    });
  }

  it('starts empty and cannot be saved before the required data is typed', async () => {
    await render();

    expect(internals.rules()).toHaveLength(1);
    expect(internals.canSubmit()).toBe(false);
    fill();
    expect(internals.canSubmit()).toBe(true);
  });

  it('emits the payload with normalised domains and rules numbered in tens', async () => {
    await render();
    fill();
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);

    internals.submit();

    expect(submitted).toHaveBeenCalledTimes(1);
    const payload = submitted.mock.calls[0][0] as CcvConventionPayload;
    expect(payload.allowed_email_domains).toEqual(['@acme.it']);
    expect(payload.currency).toBe('EUR');
    expect(payload.slug).toBeNull();
    expect(payload.discount_rules.map((rule) => rule.priority)).toEqual([10]);
  });

  it('builds the discount matrix: add, reorder, edit and remove keep the priorities in tens', async () => {
    await render();
    internals.updateRule(0, { discount_percentage: 10 });
    internals.addRule();
    internals.updateRule(1, { discount_percentage: 25, rule_type: 'GLOBAL_PERCENTAGE' });

    internals.move(1, -1);

    expect(internals.rules().map((rule) => rule.discount_percentage)).toEqual([25, 10]);
    expect(internals.rules().map((rule) => rule.priority)).toEqual([10, 20]);

    internals.removeRule(0);
    expect(internals.rules().map((rule) => rule.priority)).toEqual([10]);
  });

  it('blocks a rule without its target and a percentage out of range', async () => {
    await render();
    fill();

    internals.updateRule(0, { rule_type: 'PRICE_LIST' });
    expect(internals.problems()).toEqual([{ row: 1, code: 'discount_rule_target_missing' }]);
    expect(internals.canSubmit()).toBe(false);

    internals.updateRule(0, { rule_type: 'GLOBAL_PERCENTAGE', discount_percentage: 150 });
    expect(internals.problems()[0].code).toBe('discount_percentage_out_of_range');
    internals.updateRule(0, { discount_percentage: 12 });
    expect(internals.canSubmit()).toBe(true);
  });

  it('refuses an invalid e-mail domain and a broken card pattern', async () => {
    await render();
    fill();

    internals.form.controls['allowed_email_domains'].setValue(['not a domain']);
    expect(internals.canSubmit()).toBe(false);
    internals.form.controls['allowed_email_domains'].setValue(['acme.it']);
    internals.form.patchValue({ card_number_regex: '([' });
    expect(internals.canSubmit()).toBe(false);
    internals.form.patchValue({ card_number_regex: '^AC\\d{6}$' });
    expect(internals.canSubmit()).toBe(true);
  });

  it('loads a stored convention into the form with its matrix in priority order', async () => {
    await render(convention('1', { name: 'Stored one' }));

    const payload = internals.payload();
    expect(payload.name).toBe('Stored one');
    expect(payload.annual_spending_cap_per_beneficiary).toBe(1000);
    expect(payload.employer_subsidy_value).toBe(20);
    expect(payload.discount_rules).toHaveLength(1);
    expect(payload.discount_rules[0].discount_percentage).toBe(15);
  });

  it('drops the subsidy and the family limit when they are switched off', async () => {
    await render(convention('1'));

    internals.form.patchValue({ employer_subsidy_enabled: false, allow_family_members: false });
    const payload = internals.payload();

    expect(payload.employer_subsidy_type).toBeNull();
    expect(payload.employer_subsidy_value).toBeNull();
    expect(payload.max_family_members).toBe(0);
  });

  it('previews the SHA-256 of the employer list before it is imported and sends the identifiers once', async () => {
    await render(convention('1', { verification_methods: ['HASHED_EMPLOYEE_LIST'] }));
    const requests: { identifiers: string[]; dryRun: boolean }[] = [];
    fixture.componentInstance.importRequested.subscribe((request) => requests.push(request));

    internals.pasted.set('matricola\nA001\nA002\na001\n');
    expect(internals.identifiers()).toEqual(['A001', 'A002']);

    await internals.previewHashes();
    expect(internals.localPreview()).toHaveLength(2);
    expect(internals.localPreview()[0].sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(internals.localPreview()[0].hint).toBe('***001');

    internals.importList();
    expect(requests).toEqual([
      { identifiers: ['A001', 'A002'], dryRun: true },
      { identifiers: ['A001', 'A002'], dryRun: false },
    ]);
    expect(internals.identifiers()).toEqual([]);
  });
});
