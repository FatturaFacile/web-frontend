import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService, WrThreshold } from '@core';
import { ThresholdBarsComponent } from './threshold-bars.component';
import { translateSpy } from './withholding-recipients.testing';

const sports: WrThreshold[] = [
  { key: 'sports_5000', current: '6000.00', limit: '5000.00', percent: 120 },
  { key: 'sports_15000', current: '6000.00', limit: '15000.00', percent: 40 },
];

describe('ThresholdBarsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: translateSpy() }],
    });
  });

  async function render(thresholds: WrThreshold[], compact = false) {
    const fixture = TestBed.createComponent(ThresholdBarsComponent);
    fixture.componentRef.setInput('thresholds', thresholds);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows a bar with its translated label for every threshold', async () => {
    const fixture = await render([
      { key: 'occasional_5000', current: '3000.00', limit: '5000.00', percent: 60 },
      { key: 'avs_2300', current: '2400.00', limit: '2300.00', percent: 104 },
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(fixture.nativeElement.querySelectorAll('nz-progress')).toHaveLength(2);
    expect(text).toContain('withholdingRecipients.threshold.occasional_5000');
    expect(text).toContain('withholdingRecipients.threshold.avs_2300');
  });

  it('draws the two amateur sports thresholds as two tiers of one bar', async () => {
    const fixture = await render(sports);
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(fixture.componentInstance.bars()).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('nz-progress')).toHaveLength(2);
    expect(text).toContain('withholdingRecipients.threshold.sports_5000');
    expect(text).toContain('withholdingRecipients.threshold.sports_15000');
  });

  it('keeps the percentage inside the bar and reports the state of the limit', async () => {
    const fixture = await render(sports);
    const bars = fixture.componentInstance;

    expect(bars.clamp(120)).toBe(100);
    expect(bars.clamp(-3)).toBe(0);
    expect(bars.status(120)).toBe('exception');
    expect(bars.status(85)).toBe('active');
    expect(bars.status(10)).toBe('normal');
  });

  it('renders nothing for a recipient without thresholds and a compact layout on request', async () => {
    const empty = await render([]);
    expect(empty.nativeElement.querySelectorAll('nz-progress')).toHaveLength(0);

    const compact = await render(sports, true);
    expect(compact.nativeElement.querySelector('.compact')).not.toBeNull();
  });
});
