import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { PcBillingComponent } from './pc-billing.component';
import { PcBudgetComponent } from './pc-budget.component';
import { PcChangeOrdersComponent } from './pc-change-orders.component';
import { PcCostsComponent } from './pc-costs.component';
import { ProjectControlComponent } from './project-control.component';

describe('Project control pages boot against an empty backend', () => {
  const tabs = [
    ['billing', PcBillingComponent],
    ['budget', PcBudgetComponent],
    ['change orders', PcChangeOrdersComponent],
    ['costs', PcCostsComponent],
  ] as const;

  it.each(tabs)('%s tab', async (_name, component) => {
    const { fixture } = await renderPageWithEmptyBackend(component, { projectId: 'project-1' });

    expect(fixture.nativeElement).toBeTruthy();
  });

  it('project control shell', async () => {
    const { fixture } = await renderPageWithEmptyBackend(ProjectControlComponent);

    expect(fixture.nativeElement).toBeTruthy();
  });
});
