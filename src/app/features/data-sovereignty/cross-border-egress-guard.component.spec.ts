import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrossBorderEgressGuardComponent } from './cross-border-egress-guard.component';
import { DataSovereigntyApiService } from './data-sovereignty-api.service';
import {
  all,
  baseProviders,
  byId,
  dashboardFixture,
  ok,
  ruleFixtures,
  settle,
} from './data-sovereignty.testing';

function type(element: HTMLElement | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CrossBorderEgressGuardComponent', () => {
  let fixture: ComponentFixture<CrossBorderEgressGuardComponent>;
  let api: {
    dashboard: ReturnType<typeof vi.fn>;
    rules: ReturnType<typeof vi.fn>;
    validateTransfer: ReturnType<typeof vi.fn>;
  };

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(CrossBorderEgressGuardComponent);
    await settle(fixture);
  }

  beforeEach(() => {
    api = {
      dashboard: vi.fn(() => ok(dashboardFixture())),
      rules: vi.fn(() => ok(ruleFixtures())),
      validateTransfer: vi.fn(() =>
        ok({
          allowed: false,
          destination_country_iso2: 'US',
          decision_status: 'BLOCKED',
          jurisdiction_zone: 'Strict-CH-Only',
          reason: 'Transfer to US is BLOCKED under Strict-CH-Only.',
          legal_basis_reference: 'Art. 16 Abs. 1 nLPD / Annex 1 DSV',
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: baseProviders([
        provideRouter([]),
        { provide: DataSovereigntyApiService, useValue: api },
      ]) as never,
    });
  });

  it('shows the Swiss adequacy matrix first, with the legal basis and the decision', async () => {
    await create();

    expect(
      all(fixture, '[data-testid^="rule-"]').map((row) => row.getAttribute('data-testid')),
    ).toEqual(['rule-DE', 'rule-US']);
    expect(byId(fixture, 'rule-DE')?.textContent).toContain('DATA_SOVEREIGNTY.DECISION_ALLOWED');
    expect(byId(fixture, 'rule-US')?.textContent).toContain('DATA_SOVEREIGNTY.DECISION_BLOCKED');
    expect(byId(fixture, 'rule-US')?.textContent).toContain('nLPD');
  });

  it('switches to the Italian zone and its GDPR basis', async () => {
    await create();

    fixture.componentInstance['zone'].set('Strict-IT-Only');
    await settle(fixture);

    expect(
      all(fixture, '[data-testid^="rule-"]').map((row) => row.getAttribute('data-testid')),
    ).toEqual(['rule-CH', 'rule-CN']);
    expect(byId(fixture, 'rule-CH')?.textContent).toContain('GDPR Art. 45');
  });

  it('lists the blocked transfers and their count', async () => {
    await create();

    expect(byId(fixture, 'blocked-counter')?.textContent).toContain('3');
    const rows = all(fixture, '[data-testid="blocked-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('US');
    expect(rows[0].textContent).toContain('webhook');
  });

  it('tests an endpoint and shows the verdict with its legal basis', async () => {
    await create();
    expect((byId(fixture, 'run-test') as HTMLButtonElement).disabled).toBe(true);

    type(byId(fixture, 'target'), 'https://hooks.example.us/x');
    type(byId(fixture, 'country'), 'us');
    await settle(fixture);
    (byId(fixture, 'run-test') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.validateTransfer).toHaveBeenCalledWith({
      target: 'https://hooks.example.us/x',
      purpose: 'webhook',
      destination_country_iso2: 'US',
    });
    const verdict = byId(fixture, 'verdict')?.textContent ?? '';
    expect(verdict).toContain('DATA_SOVEREIGNTY.VERDICT_BLOCKED');
    expect(verdict).toContain('Art. 16 Abs. 1 nLPD / Annex 1 DSV');
  });

  it('shows an allowed destination as allowed and sends no country when none is typed', async () => {
    api.validateTransfer.mockReturnValue(
      ok({
        allowed: true,
        destination_country_iso2: 'DE',
        decision_status: 'ALLOWED',
        jurisdiction_zone: 'Strict-CH-Only',
        reason: null,
        legal_basis_reference: 'Art. 16 Abs. 1 nLPD / Annex 1 DSV',
      }),
    );
    await create();

    type(byId(fixture, 'target'), 'https://hooks.example.de/x');
    await settle(fixture);
    (byId(fixture, 'run-test') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.validateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ destination_country_iso2: null }),
    );
    expect(byId(fixture, 'verdict')?.textContent).toContain('DATA_SOVEREIGNTY.VERDICT_ALLOWED');
  });

  it('reports a failed test', async () => {
    api.validateTransfer.mockReturnValue(throwError(() => new Error('500')));
    await create();

    type(byId(fixture, 'target'), 'https://hooks.example.de/x');
    await settle(fixture);
    (byId(fixture, 'run-test') as HTMLButtonElement).click();
    await settle(fixture);

    expect(byId(fixture, 'test-error')).not.toBeNull();
    expect(byId(fixture, 'verdict')).toBeNull();
  });

  it('rejects a country that is not two letters', async () => {
    await create();

    type(byId(fixture, 'target'), 'https://hooks.example.de/x');
    type(byId(fixture, 'country'), 'USA');
    await settle(fixture);

    expect((byId(fixture, 'run-test') as HTMLButtonElement).disabled).toBe(true);
  });
});
