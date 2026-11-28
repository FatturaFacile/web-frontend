import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService, WithholdingRecipientsApiService } from '@core';
import { icons } from '../../icons-provider';
import { SimulatorComponent } from './simulator.component';
import {
  lookups,
  recipient,
  simulation,
  translateSpy,
  wrap,
} from './withholding-recipients.testing';

describe('SimulatorComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      simulate: vi.fn(() => of(wrap(simulation()))),
      getLookups: vi.fn(() => of(wrap(lookups))),
      listRecipients: vi.fn(() =>
        of(wrap([recipient('r-1'), recipient('r-2', { regime: 'agent_25bis' })])),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: WithholdingRecipientsApiService, useValue: api },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function render() {
    const fixture = TestBed.createComponent(SimulatorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const text = (root: HTMLElement) => root.textContent ?? '';

  it('loads the recipients and shows the empty state until an amount is typed', async () => {
    const fixture = await render();

    expect(api['listRecipients']).toHaveBeenCalledTimes(1);
    expect(api['simulate']).not.toHaveBeenCalled();
    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.simulator.empty');
  });

  it('shows the figures, the warnings, the notes and the thresholds of the calculation', async () => {
    const fixture = await render();
    const store = fixture.componentInstance.store;

    store.patch({ gross_amount: 1000 });
    await store.simulate();
    fixture.detectChanges();
    const content = text(fixture.nativeElement);

    expect(content).toContain('withholdingRecipients.result.netPayable');
    expect(content).toContain('685.40');
    expect(content).toContain('withholdingRecipients.result.inpsWorker');
    expect(content).toContain('withholdingRecipients.result.inpsCompany');
    expect(content).toContain('withholdingRecipients.result.companyCost');
    expect(content).toContain('withholdingRecipients.warning.inps_threshold_exceeded');
    expect(content).toContain('withholdingRecipients.note.revenue_stamp_applied');
    expect(content).toContain('withholdingRecipients.threshold.occasional_5000');
    expect(content).toContain('withholdingRecipients.causal.M');
    store.dispose();
  });

  it('shows only the lines that are not zero and the flat-rate share when there is a deduction', async () => {
    api['simulate'].mockReturnValue(
      of(
        wrap(
          simulation({
            flat_rate_deduction: '250.00',
            taxable_base: '750.00',
            inps_total: '0.00',
            stamp_duty: '0.00',
            enasarco_agent: '87.50',
            enasarco_company: '87.50',
          }),
        ),
      ),
    );
    const fixture = await render();
    const store = fixture.componentInstance.store;

    store.patch({ gross_amount: 1000 });
    await store.simulate();
    fixture.detectChanges();
    const content = text(fixture.nativeElement);

    expect(content).toContain('withholdingRecipients.result.flatRate');
    expect(content).not.toContain('withholdingRecipients.result.inpsWorker');
    expect(content).not.toContain('withholdingRecipients.result.stampDuty');
    expect(content).toContain('withholdingRecipients.result.enasarcoAgent');
    store.dispose();
  });

  it('asks for the facts of the regime when there is no registered recipient', async () => {
    const fixture = await render();
    const store = fixture.componentInstance.store;
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#wr-sim-tax-code')).not.toBeNull();
    expect(root.querySelector('#wr-sim-prior-company')).not.toBeNull();

    store.patch({ regime: 'agent_25bis' });
    fixture.detectChanges();
    expect(text(root)).toContain('withholdingRecipients.field.reducedCertificate');
    expect(root.querySelector('#wr-sim-prior-company')).toBeNull();

    store.patch({ regime: 'swiss_de_minimis' });
    fixture.detectChanges();
    expect(root.querySelector('#wr-sim-canton')).not.toBeNull();
    expect(root.querySelector('#wr-sim-tax-code')).toBeNull();
    expect(text(root)).toContain('withholdingRecipients.field.priorAvsBase');
    store.dispose();
  });

  it('hides the ad-hoc facts once a registered recipient is picked', async () => {
    const fixture = await render();
    const store = fixture.componentInstance.store;

    store.pickRecipient('r-2');
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.regime.agent_25bis');
    expect((fixture.nativeElement as HTMLElement).querySelector('#wr-sim-tax-code')).toBeNull();
    store.dispose();
  });

  it('shows the refusal of the API with its translation key', async () => {
    api['simulate'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'service_after_payment', detail: 'x' },
          }),
      ),
    );
    const fixture = await render();
    const store = fixture.componentInstance.store;

    store.patch({ gross_amount: 100 });
    await store.simulate();
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toContain(
      'withholdingRecipients.error.service_after_payment',
    );
    store.dispose();
  });
});
