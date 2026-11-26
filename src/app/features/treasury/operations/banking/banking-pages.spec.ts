import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { BankingApiService } from '@core/api/banking-api.service';
import { TreasuryApiService } from '@core/api/treasury-api.service';
import { TreasuryBankingApiService } from '@core/api/treasury-banking-api.service';
import { TrF24Component } from './tr-f24.component';
import { TrPaymentFlowsComponent } from './tr-payment-flows.component';
import { TrSmartReconciliationComponent } from './tr-smart-reconciliation.component';
import { TrStatementHubComponent } from './tr-statement-hub.component';

const empty = {
  success: true,
  data: [],
  meta: { total: 0, current_page: 1, per_page: 25, last_page: 1 },
};

/** Every method answers with an empty envelope, and the calls are recorded. */
function stub(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
  const calls: Record<string, ReturnType<typeof vi.fn>> = {};

  return new Proxy(calls, {
    get(target, name: string) {
      if (name in overrides) {
        return overrides[name];
      }
      target[name] ??= vi.fn().mockReturnValue(of(empty));

      return target[name];
    },
  });
}

async function mount<T>(
  component: new () => T,
  banking = stub(),
  treasury = stub(),
  bank = stub(),
) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [
      provideNzI18n(en_US),
      provideNzIcons(icons),
      provideNzDateFnsAdapter(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TreasuryBankingApiService, useValue: banking },
      { provide: TreasuryApiService, useValue: treasury },
      { provide: BankingApiService, useValue: bank },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, banking, treasury, bank };
}

describe('TrPaymentFlowsComponent', () => {
  it('loads the supported flows and the bank accounts on open', async () => {
    const { fixture, banking, treasury } = await mount(TrPaymentFlowsComponent);

    expect(banking['getPaymentFlows']).toHaveBeenCalledTimes(1);
    expect(treasury['getBankAccounts']).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement).toBeTruthy();
  });
});

describe('TrF24Component', () => {
  it('loads the tax codes and the delegations on open', async () => {
    const { fixture, banking } = await mount(TrF24Component);

    expect(banking['getF24TaxCodes']).toHaveBeenCalledTimes(1);
    expect(banking['getF24Delegations']).toHaveBeenCalled();
    expect(fixture.nativeElement).toBeTruthy();
  });
});

describe('TrStatementHubComponent', () => {
  it('loads the CSV profiles, the open banking connections and the batches on open', async () => {
    const { fixture, banking } = await mount(TrStatementHubComponent);

    expect(banking['getCsvProfiles']).toHaveBeenCalledTimes(1);
    expect(banking['getOpenBankingStatus']).toHaveBeenCalled();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('refuses an unsupported file without calling the API', async () => {
    const { fixture, banking } = await mount(TrStatementHubComponent);

    fixture.componentInstance.handle(new File(['x'], 'statement.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(banking['importStatement']).not.toHaveBeenCalled();
  });
});

describe('TrSmartReconciliationComponent', () => {
  it('loads the statements and the lines with their proposals on open', async () => {
    const { fixture, banking, bank } = await mount(TrSmartReconciliationComponent);

    expect(bank['getBankStatements']).toHaveBeenCalledTimes(1);
    expect(banking['getSmartLines']).toHaveBeenCalled();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
