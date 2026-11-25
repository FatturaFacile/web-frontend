import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FrnBenchmark } from '@core';
import { I18nService } from '@core/i18n/i18n.service';
import { BenchmarkPanelComponent } from './benchmark-panel.component';

const benchmark = (overrides: Partial<FrnBenchmark> = {}): FrnBenchmark => ({
  period: '2028-03',
  cluster: 'medium',
  cluster_hidden: false,
  rows: [
    {
      code: 'avg_ticket',
      label: 'Average ticket',
      description: 'Net sales divided by tickets',
      unit: 'currency',
      higher_is_better: true,
      own: '41.00',
      network: { average: '37.00', median: '36.50', p75: '45.00', sample_size: 6 },
      cluster: { average: '38.00', median: '39.00', p75: '44.00', sample_size: 4 },
      position: 'above_median',
    },
    {
      code: 'lfl_growth',
      label: 'Like-for-like growth',
      description: '',
      unit: 'percent',
      higher_is_better: true,
      own: null,
      network: { average: '3.20', median: '3.00', p75: '5.00', sample_size: 6 },
      cluster: null,
      position: null,
    },
  ],
  ...overrides,
});

function render(data: FrnBenchmark | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: I18nService, useValue: { translate: (key: string) => key } }],
  });
  const fixture = TestBed.createComponent(BenchmarkPanelComponent);
  fixture.componentRef.setInput('benchmark', data);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BenchmarkPanelComponent', () => {
  it('draws, for every KPI, the store against the cluster median, the network average and the top quartile', () => {
    const element = render(benchmark());

    expect(element.querySelectorAll('section.bench-row')).toHaveLength(2);
    const first = element.querySelector('section.bench-row') as HTMLElement;
    expect(first.querySelectorAll('.bench-bar')).toHaveLength(4);
    expect(first.textContent).toContain('41.00');
    expect(first.textContent).toContain('39.00');
    expect(first.textContent).toContain('37.00');
    expect(first.textContent).toContain('44.00');
    expect(first.textContent).toContain('franchiseNetwork.position.above_median');
  });

  it('shows a dash where the store has no value and drops the cluster bar when it is hidden', () => {
    const element = render(benchmark({ cluster_hidden: true }));

    expect(element.querySelector('nz-alert')).not.toBeNull();
    const second = element.querySelectorAll('section.bench-row')[1] as HTMLElement;
    expect(second.querySelectorAll('.bench-bar')).toHaveLength(3);
    expect(second.textContent).toContain('—');
  });

  it('shows the empty state when there is nothing to compare', () => {
    const element = render(benchmark({ rows: [] }));

    expect(element.querySelectorAll('section.bench-row')).toHaveLength(0);
    expect(element.querySelector('nz-empty')).not.toBeNull();
  });
});
