import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TtIntegrityReport } from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { TimeTravelBarComponent } from './time-travel-bar.component';
import { endOfLastFiscalYear, endOfLastQuarter, presetCoordinates } from './time-travel.util';

/** Translations are API-served: the specs only need to see which key (and params) a template asks for. */
const i18n = {
  dictionaryLocale: () => 'en',
  translate: (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key),
};

const report = (overrides: Partial<TtIntegrityReport> = {}): TtIntegrityReport => ({
  verified: true,
  events_checked: 42,
  broken_at: null,
  merkle_root: 'a'.repeat(64),
  anchors: [],
  generated_at: '2026-04-01T10:00:00Z',
  standard_codes: ['GEBUEV', 'ART_957A_CO'],
  ...overrides,
});

describe('TimeTravelBarComponent', () => {
  let api: { auditIntegrity: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { auditIntegrity: vi.fn(() => of({ success: true, message: '', data: report() })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: TimeTravelApiService, useValue: api },
        { provide: I18nService, useValue: i18n },
      ],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(TimeTravelBarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, context: TestBed.inject(TimeTravelContextService) };
  }

  const click = (root: HTMLElement, testId: string) =>
    (root.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();

  it('offers only the activation while the mode is off and never calls the API', async () => {
    const { root } = await create();

    expect(root.querySelector('[data-testid="tt-activate"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tt-banner"]')).toBeNull();
    expect(api.auditIntegrity).not.toHaveBeenCalled();
  });

  it('shows the amber banner with both dates once activated', async () => {
    const { fixture, root, context } = await create();

    click(root, 'tt-activate');
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();

    const banner = root.querySelector('[data-testid="tt-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('TIME_TRAVEL.BANNER.MESSAGE');
    expect(banner?.textContent).toContain('validAt');
    expect(banner?.textContent).toContain('knownAt');
  });

  it('shows the verified Merkle pill and the GeBüV message when the chain is intact', async () => {
    const { fixture, root, context } = await create();

    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.auditIntegrity).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-testid="tt-integrity-pill"]')?.textContent).toContain('TIME_TRAVEL.INTEGRITY.VERIFIED');
    expect(root.querySelector('[data-testid="tt-compliance"]')?.textContent).toContain('TIME_TRAVEL.INTEGRITY.COMPLIANCE_OK');
  });

  it('flags a broken chain', async () => {
    api.auditIntegrity.mockReturnValue(
      of({
        success: true,
        message: '',
        data: report({ verified: false, broken_at: { event_id: 'e-9', sequence_number: 9, reason: 'hash_mismatch' } }),
      }),
    );
    const { fixture, root, context } = await create();

    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="tt-integrity-pill"]')?.textContent).toContain('TIME_TRAVEL.INTEGRITY.BROKEN');
    expect(root.querySelector('[data-testid="tt-compliance"]')?.textContent).toContain('COMPLIANCE_BROKEN');
  });

  it('degrades to an unavailable pill when the integrity call fails', async () => {
    api.auditIntegrity.mockReturnValue(throwError(() => new Error('boom')));
    const { fixture, root, context } = await create();

    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="tt-integrity-pill"]')?.textContent).toContain('TIME_TRAVEL.INTEGRITY.UNAVAILABLE');
  });

  it('resets to the live state', async () => {
    const { fixture, root, context } = await create();
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();

    click(root, 'tt-reset');
    fixture.detectChanges();

    expect(context.isActive()).toBe(false);
    expect(root.querySelector('[data-testid="tt-banner"]')).toBeNull();
  });

  it('applies the fiscal year close preset', async () => {
    const { fixture, root, context } = await create();
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();

    click(root, 'tt-preset-FISCAL_YEAR_CLOSE');

    expect(context.validAt()?.getMonth()).toBe(11);
    expect(context.validAt()?.getDate()).toBe(31);
    expect(context.isDiffMode()).toBe(false);
  });

  it('opens the cut-off diff with the audit date vs today preset and with the shortcut', async () => {
    const { fixture, root, context } = await create();
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();

    click(root, 'tt-preset-AUDIT_VS_TODAY');
    expect(context.isDiffMode()).toBe(true);
    expect(context.diffRangeValid()).toBe(true);

    context.disableDiff();
    fixture.detectChanges();
    click(root, 'tt-diff-on');
    fixture.detectChanges();

    expect(context.isDiffMode()).toBe(true);
    expect(root.querySelector('[data-testid="tt-diff-off"]')).not.toBeNull();
  });

  it('only offers the what-if replay when the host asks for it', async () => {
    const { fixture, root, context } = await create();
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T10:00:00Z'));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="tt-whatif"]')).toBeNull();

    fixture.componentRef.setInput('whatIf', true);
    fixture.detectChanges();
    const requested = vi.fn();
    fixture.componentInstance.whatIfRequested.subscribe(requested);
    click(root, 'tt-whatif');

    expect(requested).toHaveBeenCalledTimes(1);
  });
});

describe('time travel presets', () => {
  it('ends the last quarter on the previous quarter boundary', () => {
    const end = endOfLastQuarter(new Date(2026, 4, 12));

    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 2, 31]);
  });

  it('wraps to the previous year in the first quarter', () => {
    const end = endOfLastQuarter(new Date(2026, 1, 10));

    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2025, 11, 31]);
  });

  it('closes the fiscal year on 31 December of the previous year', () => {
    const end = endOfLastFiscalYear(new Date(2026, 6, 1));

    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2025, 11, 31]);
  });

  it('knows the close 15 days after the year end for the audit preset and compares with today', () => {
    const today = new Date(2026, 6, 1);
    const preset = presetCoordinates('AUDIT_VS_TODAY', today);

    expect(preset.knownAt.getMonth()).toBe(0);
    expect(preset.knownAt.getDate()).toBe(15);
    expect(preset.comparisonKnownAt).toEqual(today);
  });
});
