import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../testing/component-smoke';
import { TrBalancesComponent } from './operations/balances/tr-balances.component';
import { TrCollectionsComponent } from './operations/collections/tr-collections.component';
import { TrKpisComponent } from './operations/kpis/tr-kpis.component';
import { TrLiquidityComponent } from './operations/liquidity/tr-liquidity.component';
import { TrPagoPaNoticesComponent } from './operations/pagopa/tr-pagopa-notices.component';
import { TrRibaComponent } from './operations/riba/tr-riba.component';
import { TrReconciliationRulesComponent } from './operations/rules/tr-reconciliation-rules.component';
import { TreasuryOperationsShellComponent } from './operations/treasury-operations-shell.component';

describe('Treasury operations pages boot against an empty backend', () => {
  const pages = [
    ['balances', TrBalancesComponent],
    ['collections', TrCollectionsComponent],
    ['KPIs', TrKpisComponent],
    ['liquidity', TrLiquidityComponent],
    ['pagoPA notices', TrPagoPaNoticesComponent],
    ['Ri.Ba.', TrRibaComponent],
    ['reconciliation rules', TrReconciliationRulesComponent],
    ['shell', TreasuryOperationsShellComponent],
  ] as const;

  it.each(pages)('%s', async (_name, component) => {
    const { fixture } = await renderPageWithEmptyBackend(component);

    expect(fixture.nativeElement).toBeTruthy();
  });
});
