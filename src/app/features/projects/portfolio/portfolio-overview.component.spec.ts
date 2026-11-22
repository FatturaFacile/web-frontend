import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PermissionsService } from '@core';
import { PortfolioOverviewComponent } from './portfolio-overview.component';
import { project } from './portfolio.testing';

interface Call {
  method: string;
  url: string;
  body: unknown;
  params: Record<string, string>;
}

const PROJECTS = [
  project({ id: 'a', status: 'Active', plannedCost: 1000, actualCost: 400, plannedRevenue: 3000, percentComplete: 40, cupCode: 'B11H20000010001', cigCode: '8123456AB1' }),
  project({ id: 'b', status: 'OnHold', plannedCost: 500, actualCost: 100, plannedRevenue: 800, percentComplete: 20 }),
  project({ id: 'c', status: 'Completed', plannedCost: 100, actualCost: 120, plannedRevenue: 200, percentComplete: 100 }),
];

function answer(request: TestRequest, calls: Call[]): void {
  const { method, url, body, params } = request.request;
  calls.push({ method, url, body, params: Object.fromEntries(params.keys().map((key) => [key, params.get(key) ?? ''])) });

  if (url.includes('/translations/')) {
    request.flush({ translations: {} });
  } else if (method === 'GET' && url.endsWith('/projects/portfolio')) {
    request.flush({ data: PROJECTS });
  } else if (method === 'GET' && url.endsWith('/projects/templates')) {
    request.flush({ data: [{ id: 't1', name: 'Fit-out template' }] });
  } else if (method === 'GET' && url.endsWith('/baselines')) {
    request.flush({ data: [{ id: 'b1', projectId: 'a', baselineNumber: 1, name: 'Kick-off', capturedAt: '2027-01-01' }] });
  } else if (method === 'GET' && url.endsWith('/variance')) {
    request.flush({
      data: {
        baselineId: 'b1',
        projectEndVarianceDays: 4,
        rows: [{ nodeId: 'n1', wbsCode: '1.1', title: 'Design', startVarianceDays: 0, endVarianceDays: 4, plannedHoursVariance: 8, plannedCostVariance: 400 }],
      },
    });
  } else {
    request.flush({ data: {} });
  }
}

async function settle(fixture: ComponentFixture<PortfolioOverviewComponent>, http: HttpTestingController, calls: Call[]): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    for (const request of http.match(() => true)) {
      answer(request, calls);
    }

    fixture.detectChanges();
  }
}

async function render(canWrite = true) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PortfolioOverviewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: PermissionsService, useValue: { canWrite: () => canWrite, canRead: () => true } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PortfolioOverviewComponent);
  const http = TestBed.inject(HttpTestingController);
  const calls: Call[] = [];

  fixture.detectChanges();
  await settle(fixture, http, calls);

  return { fixture, component: fixture.componentInstance, calls, element: fixture.nativeElement as HTMLElement, settle: () => settle(fixture, http, calls) };
}

describe('PortfolioOverviewComponent', () => {
  it('loads the portfolio and lists the projects with their codes', async () => {
    const { calls, element } = await render();

    expect(calls.some((call) => call.method === 'GET' && call.url.endsWith('/projects/portfolio'))).toBe(true);
    expect(element.querySelectorAll('[data-testid^="pf-row-"]')).toHaveLength(3);
    expect(element.querySelector('[data-testid="pf-row-a"]')?.textContent).toContain('CUP B11H20000010001');
    expect(element.querySelector('[data-testid="pf-row-a"]')?.textContent).toContain('CIG 8123456AB1');
    expect(element.querySelector('[data-testid="pf-row-b"]')?.textContent).not.toContain('CUP');
  });

  it('shows the KPIs of the listed projects', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="pf-kpi-total"]')?.textContent?.trim()).toBe('3');
    expect(element.querySelector('[data-testid="pf-kpis"]')?.textContent).toContain('1');
  });

  it('links every project to its WBS and Kanban workspaces', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="pf-open-a"]')?.getAttribute('href')).toBe('/projects/a/wbs');
  });

  it('asks the API for the filtered portfolio', async () => {
    const { component, calls, settle: flush } = await render();

    component.search.set('fit-out');
    component.setStatusFilter('Active');
    await flush();

    const last = calls.filter((call) => call.url.endsWith('/projects/portfolio')).at(-1);

    expect(last?.params).toEqual({ status: 'Active', search: 'fit-out' });

    component.setTypeFilter('CapexInvestment');
    await flush();

    expect(calls.filter((call) => call.url.endsWith('/projects/portfolio')).at(-1)?.params['projectType']).toBe('CapexInvestment');
  });

  it('creates a project with the Italian CUP and CIG in uppercase', async () => {
    const { component, calls, settle: flush } = await render();

    component.openCreate();
    component.projectForm.patchValue({ projectCode: 'P-9', name: 'Hospital wing', cupCode: 'b11h20000010001', cigCode: '8123456ab1', startDate: '2027-02-01', targetEndDate: '2027-08-01' });
    component.saveProject();
    await flush();

    const post = calls.find((call) => call.method === 'POST' && call.url.endsWith('/projects'));

    expect(post?.body).toMatchObject({ projectCode: 'P-9', name: 'Hospital wing', cupCode: 'B11H20000010001', cigCode: '8123456AB1', customerId: null });
  });

  it('drops CUP and CIG for a Swiss project', async () => {
    const { component, calls, settle: flush } = await render();

    component.openCreate();
    component.projectForm.patchValue({ projectCode: 'P-10', name: 'Zurich office', cupCode: 'B11H20000010001' });
    component.projectForm.controls.context.setValue('CH');
    component.saveProject();
    await flush();

    const post = calls.find((call) => call.method === 'POST' && call.url.endsWith('/projects'));

    expect(post?.body).toMatchObject({ cupCode: null, cigCode: null });
  });

  it('refuses malformed CUP, CIG, UUIDs and an end date before the start', async () => {
    const { component, calls } = await render();
    const before = calls.length;

    component.openCreate();
    component.projectForm.patchValue({ projectCode: 'P-11', name: 'Bad', cupCode: 'short', cigCode: '123', customerId: 'not-a-uuid', startDate: '2027-05-01', targetEndDate: '2027-04-01' });

    expect(component.projectForm.controls.cupCode.errors).toHaveProperty('pattern');
    expect(component.projectForm.controls.cigCode.errors).toHaveProperty('pattern');
    expect(component.projectForm.controls.customerId.errors).toHaveProperty('uuid');
    expect(component.projectForm.controls.targetEndDate.invalid).toBe(true);

    component.saveProject();

    expect(calls.length).toBe(before);
  });

  it('edits a project with a PUT', async () => {
    const { component, calls, settle: flush } = await render();

    component.openEdit(PROJECTS[0]);

    expect(component.projectForm.getRawValue().cupCode).toBe('B11H20000010001');
    expect(component.projectForm.getRawValue().context).toBe('IT');

    component.projectForm.patchValue({ name: 'Renamed' });
    component.saveProject();
    await flush();

    const put = calls.find((call) => call.method === 'PUT' && call.url.endsWith('/projects/a'));

    expect(put?.body).toMatchObject({ name: 'Renamed', cupCode: 'B11H20000010001' });
  });

  it('creates a project from a template', async () => {
    const { component, calls, settle: flush } = await render();

    component.openTemplate();
    await flush();
    component.templateForm.patchValue({ templateId: 't1', projectCode: 'P-12', name: 'From template', startDate: '2027-03-01' });
    component.createFromTemplate();
    await flush();

    expect(calls.some((call) => call.method === 'GET' && call.url.endsWith('/projects/templates'))).toBe(true);
    expect(calls.find((call) => call.url.endsWith('/projects/from-template'))?.body).toEqual({
      templateId: 't1',
      projectCode: 'P-12',
      name: 'From template',
      customerId: null,
      projectManagerId: null,
      startDate: '2027-03-01',
    });
  });

  it('does not create from a template without the required fields', async () => {
    const { component, calls } = await render();

    component.openTemplate();
    component.createFromTemplate();

    expect(component.templateForm.invalid).toBe(true);
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('changes the status of a project and ignores an unchanged one', async () => {
    const { component, calls, settle: flush } = await render();

    component.changeStatus(PROJECTS[0], 'Active');
    component.changeStatus(PROJECTS[0], 'OnHold');
    await flush();

    const patches = calls.filter((call) => call.method === 'PATCH');

    expect(patches).toHaveLength(1);
    expect(patches[0].url).toMatch(/\/projects\/a\/status$/);
    expect(patches[0].body).toEqual({ status: 'OnHold' });
  });

  it('captures a baseline and shows its variance report', async () => {
    const { component, calls, settle: flush } = await render();

    component.openBaselines(PROJECTS[0]);
    await flush();

    expect(component.baselines()).toHaveLength(1);

    component.baselineName.set('Re-plan');
    component.captureBaseline();
    await flush();

    expect(calls.find((call) => call.method === 'POST' && call.url.endsWith('/projects/a/baselines'))?.body).toEqual({ name: 'Re-plan' });

    component.showVariance(component.baselines()[0]);
    await flush();

    expect(component.variance()?.projectEndVarianceDays).toBe(4);
    expect(component.variance()?.rows[0].wbsCode).toBe('1.1');
  });

  it('hides the write actions from a reader', async () => {
    const { element } = await render(false);

    expect(element.querySelector('[data-testid="pf-new"]')).toBeNull();
    expect(element.querySelector('[data-testid="pf-from-template"]')).toBeNull();
    expect(element.querySelector('[data-testid="pf-edit-a"]')).toBeNull();
    expect(element.querySelector('[data-testid="pf-status-a"]')).toBeNull();
  });
});
