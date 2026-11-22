import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { ReceivablesApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { ReceivablesDashboardComponent } from './receivables-dashboard.component';
import { dashboard } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};

describe('ReceivablesDashboardComponent', () => {
  let api: { getDashboard: ReturnType<typeof vi.fn> };
  let navigate: MockInstance<Router['navigate']>;

  beforeEach(() => {
    api = { getDashboard: vi.fn(() => of({ data: dashboard })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ReceivablesApiService, useValue: api },
        { provide: TranslateService, useValue: translateSpy },
        provideRouter([]),
        provideNzIcons(icons),
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  async function render(): Promise<ComponentFixture<ReceivablesDashboardComponent>> {
    const fixture = TestBed.createComponent(ReceivablesDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ComponentFixture<unknown>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows the five KPI cards', async () => {
    const fixture = await render();
    const content = text(fixture);

    for (const key of [
      'AR.KPI_TOTAL_EXPOSURE',
      'AR.KPI_OVERDUE',
      'AR.KPI_DSO',
      'AR.KPI_PROVISION',
      'AR.KPI_BLOCKED',
    ]) {
      expect(content).toContain(key);
    }
    expect(fixture.nativeElement.querySelectorAll('.kpi')).toHaveLength(5);
    expect(content).toContain('42');
  });

  it('shows a dash for a DSO that cannot be computed', async () => {
    api.getDashboard.mockReturnValueOnce(
      of({ data: { ...dashboard, kpis: { ...dashboard.kpis, dso: null } } }),
    );

    const fixture = await render();

    expect(text(fixture)).toContain('—');
  });

  it('draws one bar per bucket of the response, in its order', async () => {
    const fixture = await render();
    const bars = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.aging-bar')];

    expect(bars).toHaveLength(4);
    expect(bars[0].textContent).toContain('AR.BUCKET_CURRENT');
    expect(bars[1].textContent).toContain('AR.BUCKET_RANGE');
    expect(bars[3].textContent).toContain('AR.BUCKET_OVER');
    const fills = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.aging-bar .fill')];
    expect(fills.map((fill) => fill.style.width)).toEqual(['100%', '50%', '25%', '0%']);
  });

  it('drills down from a bucket total of the chart to the open items of that bucket', async () => {
    const fixture = await render();
    const bars = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.aging-bar');

    bars[2].click();

    expect(navigate).toHaveBeenCalledWith(['/receivables/items'], {
      queryParams: { bucket: '31_60', currency: 'EUR', open_only: '1' },
    });
  });

  it('drills down from a customer and bucket cell of the matrix, and from the totals', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const rows = root.querySelectorAll('table.matrix tbody tr');
    // The biggest customer first: Bianchi (c-2) has money in `current` and `31_60` only.
    expect(rows[0].querySelector('th')?.textContent).toContain('Bianchi SA');
    const cells = rows[0].querySelectorAll<HTMLButtonElement>('button.link-button');
    expect(cells).toHaveLength(3);

    cells[1].click();
    expect(navigate).toHaveBeenLastCalledWith(['/receivables/items'], {
      queryParams: { bucket: '31_60', customer_id: 'c-2', currency: 'EUR', open_only: '1' },
    });

    cells[2].click();
    expect(navigate).toHaveBeenLastCalledWith(['/receivables/items'], {
      queryParams: { customer_id: 'c-2', currency: 'EUR', open_only: '1' },
    });

    const footer = root.querySelectorAll<HTMLButtonElement>('table.matrix tfoot button.link-button');
    expect(footer).toHaveLength(5);
    footer[1].click();
    expect(navigate).toHaveBeenLastCalledWith(['/receivables/items'], {
      queryParams: { bucket: '1_30', currency: 'EUR', open_only: '1' },
    });
  });

  it('lists the blocked customers with their name and reason', async () => {
    const fixture = await render();
    const blocked = (fixture.nativeElement as HTMLElement).querySelector('.grid-2 table.matrix tbody');

    expect(blocked?.textContent).toContain('Rossi SRL');
    expect(blocked?.textContent).toContain('over_limit');
  });

  it('shows the empty state of the blocked list and of the matrix when there is nothing to show', async () => {
    api.getDashboard.mockReturnValueOnce(
      of({
        data: {
          ...dashboard,
          blocked: [],
          aging: { ...dashboard.aging, customers: [] },
          kpis: { ...dashboard.kpis, blocked_customers: 0 },
        },
      }),
    );

    const fixture = await render();
    const content = text(fixture);

    expect(content).toContain('AR.NO_BLOCKED');
    expect(content).toContain('AR.NO_OPEN_ITEMS');
  });

  it('offers a currency switch only when several currencies are open', async () => {
    const fixture = await render();
    expect((fixture.nativeElement as HTMLElement).querySelector('.currency-select')).not.toBeNull();

    TestBed.resetTestingModule();
    api.getDashboard.mockReturnValue(
      of({ data: { ...dashboard, aging: { ...dashboard.aging, available_currencies: ['EUR'] } } }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: ReceivablesApiService, useValue: api },
        { provide: TranslateService, useValue: translateSpy },
        provideRouter([]),
        provideNzIcons(icons),
      ],
    });
    const single = await render();
    expect((single.nativeElement as HTMLElement).querySelector('.currency-select')).toBeNull();
  });

  it('reloads in the chosen currency', async () => {
    const fixture = await render();

    fixture.componentInstance.onCurrency('CHF');
    await fixture.whenStable();

    expect(api.getDashboard).toHaveBeenLastCalledWith('CHF');
  });

  it('shows the error of a failed load', async () => {
    api.getDashboard.mockReturnValueOnce(throwError(() => new Error('network')));

    const fixture = await render();

    expect(text(fixture)).toContain('AR.LOAD_ERROR');
  });
});
