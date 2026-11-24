import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ProjectPortfolioApiService } from './portfolio-api.service';

describe('ProjectPortfolioApiService', () => {
  let service: ProjectPortfolioApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/projects`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjectPortfolioApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectCall(method: string, url: string, body?: unknown) {
    const request = http.expectOne((candidate) => candidate.url === url && candidate.method === method);

    if (body !== undefined) {
      expect(request.request.body).toEqual(body);
    }

    request.flush({ data: {} });

    return request.request;
  }

  it('lists the portfolio with the filters that are set', () => {
    service.portfolio({ status: 'Active', projectType: 'CapexInvestment', search: '' }).subscribe();
    const request = expectCall('GET', `${base}/portfolio`);

    expect(request.params.get('status')).toBe('Active');
    expect(request.params.get('projectType')).toBe('CapexInvestment');
    expect(request.params.has('search')).toBe(false);
  });

  it('lists the portfolio without filters', () => {
    service.portfolio().subscribe();

    expect(expectCall('GET', `${base}/portfolio`).params.keys()).toEqual([]);
  });

  it('creates, reads and updates a project', () => {
    const payload = { projectCode: 'P-1', name: 'One', projectType: 'ClientBillable' as const, billingModel: 'FixedPrice' as const, cupCode: 'B11H20000010001' };

    service.create(payload).subscribe();
    expectCall('POST', base, payload);
    service.show('p1').subscribe();
    expectCall('GET', `${base}/p1`);
    service.update('p1', payload).subscribe();
    expectCall('PUT', `${base}/p1`, payload);
  });

  it('changes the status and creates from a template', () => {
    service.changeStatus('p1', 'OnHold').subscribe();
    expectCall('PATCH', `${base}/p1/status`, { status: 'OnHold' });

    const payload = { templateId: 't1', projectCode: 'P-2', name: 'Two', startDate: '2027-02-01' };
    service.createFromTemplate(payload).subscribe();
    expectCall('POST', `${base}/from-template`, payload);

    service.templates().subscribe();
    expectCall('GET', `${base}/templates`);

    service.saveTemplate({ code: 'T1', name: 'Template', sourceProjectId: 'p1' }).subscribe();
    expectCall('POST', `${base}/templates`, { code: 'T1', name: 'Template', sourceProjectId: 'p1' });
  });

  it('reads the Gantt with or without a baseline to overlay', () => {
    service.gantt('p1').subscribe();
    expect(expectCall('GET', `${base}/p1/gantt`).params.has('baselineId')).toBe(false);

    service.gantt('p1', 'b1').subscribe();
    expect(expectCall('GET', `${base}/p1/gantt`).params.get('baselineId')).toBe('b1');

    service.kanban('p1').subscribe();
    expectCall('GET', `${base}/p1/kanban`);
  });

  it('manages the WBS nodes', () => {
    const payload = { title: 'Node', nodeType: 'Phase' as const, startDate: '2027-01-04', endDate: '2027-01-08' };

    service.createNode('p1', payload).subscribe();
    expectCall('POST', `${base}/p1/wbs-nodes`, payload);
    service.updateNode('p1', 'n1', { percentComplete: 40 }).subscribe();
    expectCall('PUT', `${base}/p1/wbs-nodes/n1`, { percentComplete: 40 });
    service.deleteNode('p1', 'n1').subscribe();
    expectCall('DELETE', `${base}/p1/wbs-nodes/n1`);
    service.reorderNodes('p1', [{ id: 'n1', parentNodeId: null, sortOrder: 2 }]).subscribe();
    expectCall('PATCH', `${base}/p1/wbs-nodes/reorder`, { items: [{ id: 'n1', parentNodeId: null, sortOrder: 2 }] });
  });

  it('manages the dependencies and recalculates the CPM', () => {
    const payload = { predecessorNodeId: 'a', successorNodeId: 'b', dependencyType: 'SS' as const, lagDays: -2 };

    service.createDependency('p1', payload).subscribe();
    expectCall('POST', `${base}/p1/dependencies`, payload);
    service.updateDependency('p1', 'd1', { dependencyType: 'FF', lagDays: 1 }).subscribe();
    expectCall('PUT', `${base}/p1/dependencies/d1`, { dependencyType: 'FF', lagDays: 1 });
    service.deleteDependency('p1', 'd1').subscribe();
    expectCall('DELETE', `${base}/p1/dependencies/d1`);
    service.recalculate('p1').subscribe();
    expectCall('POST', `${base}/p1/cpm/recalculate`, {});
  });

  it('captures and reads baselines and their variance', () => {
    service.captureBaseline('p1', 'Kick-off').subscribe();
    expectCall('POST', `${base}/p1/baselines`, { name: 'Kick-off' });
    service.baselines('p1').subscribe();
    expectCall('GET', `${base}/p1/baselines`);
    service.variance('p1', 'b1').subscribe();
    expectCall('GET', `${base}/p1/baselines/b1/variance`);
  });
});
