import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService, TranslateService, WithholdingRecipientsApiService } from '@core';
import { icons } from '../../icons-provider';
import { DashboardComponent } from './dashboard.component';
import {
  dashboardMeta,
  dashboardRow,
  lookups,
  recipient,
  translateSpy,
  wrap,
} from './withholding-recipients.testing';
import { WITHHOLDING_RECIPIENTS_MODULE } from './withholding-recipients.util';

const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('DashboardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;
  let writeChecks: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    writeChecks = [];
    api = {
      getDashboard: vi.fn(() =>
        of(
          wrap(
            [
              dashboardRow('r-1'),
              dashboardRow('r-2', {
                display_name: 'Swiss Artist',
                regime: 'swiss_foreign_artist',
                jurisdiction: 'CH',
                currency: 'CHF',
                cu_causal: 'A',
                alerts: ['birth_date_missing', 'avs_de_minimis_exceeded'],
                thresholds: [
                  { key: 'avs_2300', current: '2500.00', limit: '2300.00', percent: 108 },
                ],
              }),
            ],
            dashboardMeta,
          ),
        ),
      ),
      getLookups: vi.fn(() => of(wrap(lookups))),
      getRecipient: vi.fn(() => of(wrap(recipient('r-1')))),
      getThresholds: vi.fn(() => of(wrap([]))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: WithholdingRecipientsApiService, useValue: api },
        {
          provide: PermissionsService,
          useValue: {
            canWrite: (module: string) => {
              writeChecks.push(module);
              return canWrite;
            },
          },
        },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('tbody tr')).filter((row) => row.querySelector('td'));

  it('lists the recipients with regime, jurisdiction, causal, year-to-date amounts and payments', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body).toHaveLength(2);
    expect(body[0].textContent).toContain('Recipient r-1');
    expect(body[0].textContent).toContain('withholdingRecipients.regime.occasional_worker');
    expect(body[0].textContent).toContain('withholdingRecipients.jurisdiction.IT');
    expect(body[0].textContent).toContain('withholdingRecipients.causal.M');
    expect(body[0].textContent).toContain('3,000.00');
    expect(body[0].textContent).toContain('600.00');
    expect(body[0].textContent).toContain('withholdingRecipients.threshold.occasional_5000');
  });

  it('shows the currency of each row and its translated alert tags', async () => {
    const fixture = await render();
    const second = rows(fixture.nativeElement as HTMLElement)[1];

    expect(second.textContent).toContain('CHF');
    expect(second.textContent).toContain('withholdingRecipients.alert.birth_date_missing');
    expect(second.textContent).toContain('withholdingRecipients.alert.avs_de_minimis_exceeded');
    expect(second.textContent).toContain('withholdingRecipients.threshold.avs_2300');
  });

  it('shows the summary cards from the meta of the dashboard', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('withholdingRecipients.summary.recipients');
    expect(text).toContain('withholdingRecipients.summary.withAlerts');
    expect(text).toContain('withholdingRecipients.summary.pendingInl');
    expect(text).toContain('8,000.00');
    expect(text).toContain('750.00');
  });

  it('reads the lookups and the dashboard of the current year when it opens', async () => {
    await render();

    expect(api['getLookups']).toHaveBeenCalledTimes(1);
    expect(api['getDashboard']).toHaveBeenCalledTimes(1);
  });

  it('filters by regime, jurisdiction, causal, search and alerts and reads the dashboard again', async () => {
    const fixture = await render();
    const store = fixture.componentInstance.store;

    await store.setFilters({ regime: 'amateur_sports' });
    await store.setFilters({ jurisdiction: 'CH' });
    await store.setFilters({ cuCausal: 'M' });
    fixture.componentInstance.applySearch('anna');
    await fixture.whenStable();
    await store.setFilters({ onlyAlerts: true });

    const last = api['getDashboard'].mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({
      regime: 'amateur_sports',
      jurisdiction: 'CH',
      cu_causal: 'M',
      search: 'anna',
      only_alerts: true,
    });
  });

  it('does not read again when the search did not change', async () => {
    const fixture = await render();
    api['getDashboard'].mockClear();

    fixture.componentInstance.applySearch('');

    expect(api['getDashboard']).not.toHaveBeenCalled();
  });

  it('shows the empty state when nothing matches', async () => {
    api['getDashboard'].mockReturnValue(of(wrap([], dashboardMeta)));

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'withholdingRecipients.dashboard.empty',
    );
  });

  it('shows the load failure with its translation key', async () => {
    api['getDashboard'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'withholdingRecipients.error.generic',
    );
  });

  it('opens the profile drawer on a row, empty for a new recipient', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    component.openRow(component.store.rows()[0]);
    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedId()).toBe('r-1');

    component.closeDrawer();
    expect(component.drawerOpen()).toBe(false);

    component.openNew();
    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedId()).toBeNull();
  });

  it('gates the creation with the module of the registry', async () => {
    const fixture = await render();

    expect(writeChecks).toContain(WITHHOLDING_RECIPIENTS_MODULE);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'withholdingRecipients.action.new',
    );
  });

  it('hides the new button without the write ability', async () => {
    canWrite = false;

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'withholdingRecipients.action.new',
    );
    expect(rows(fixture.nativeElement as HTMLElement)).toHaveLength(2);
  });
});
