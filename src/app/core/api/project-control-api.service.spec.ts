import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ProjectControlApiService } from '@core';

interface Case {
  name: string;
  call: (s: ProjectControlApiService) => Observable<unknown>;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

const CASES: Case[] = [
  { name: 'getBudget', call: (s) => s.getBudget('p1'), method: 'GET', path: '/p1/budget' },
  {
    name: 'saveBudget',
    call: (s) => s.saveBudget('p1', { total_revenue_budget: 1000, labour_budget: 400 }),
    method: 'POST',
    path: '/p1/budget',
    body: { total_revenue_budget: 1000, labour_budget: 400 },
  },
  { name: 'baselineBudget', call: (s) => s.baselineBudget('p1'), method: 'POST', path: '/p1/budget/baseline', body: {} },
  { name: 'approveBudget', call: (s) => s.approveBudget('p1'), method: 'POST', path: '/p1/budget/approve', body: {} },
  { name: 'rejectBudget', call: (s) => s.rejectBudget('p1', 'too high'), method: 'POST', path: '/p1/budget/reject', body: { reason: 'too high' } },
  { name: 'getMilestones', call: (s) => s.getMilestones('p1'), method: 'GET', path: '/p1/milestones' },
  {
    name: 'createMilestone',
    call: (s) => s.createMilestone('p1', { name: 'Go live', milestone_date: '2026-12-01', billing_amount: 500 }),
    method: 'POST',
    path: '/p1/milestones',
    body: { name: 'Go live', milestone_date: '2026-12-01', billing_amount: 500 },
  },
  { name: 'updateMilestone', call: (s) => s.updateMilestone('m1', { name: 'Go live 2' }), method: 'PUT', path: '/milestones/m1', body: { name: 'Go live 2' } },
  { name: 'completeMilestone', call: (s) => s.completeMilestone('m1'), method: 'POST', path: '/milestones/m1/complete', body: {} },
  { name: 'getChangeOrders', call: (s) => s.getChangeOrders('p1', { status: 'submitted' }), method: 'GET', path: '/p1/change-orders', params: { status: 'submitted' } },
  {
    name: 'createChangeOrder',
    call: (s) => s.createChangeOrder('p1', { order_number: 'CO-1', title: 'Extra', scope_description: 'More', cost_impact_amount: 100 }),
    method: 'POST',
    path: '/p1/change-orders',
    body: { order_number: 'CO-1', title: 'Extra', scope_description: 'More', cost_impact_amount: 100 },
  },
  { name: 'approveChangeOrder', call: (s) => s.approveChangeOrder('c1'), method: 'POST', path: '/change-orders/c1/approve', body: {} },
  { name: 'rejectChangeOrder', call: (s) => s.rejectChangeOrder('c1', 'no'), method: 'POST', path: '/change-orders/c1/reject', body: { reason: 'no' } },
  {
    name: 'billMilestone',
    call: (s) => s.billMilestone('p1', 'm1', { tax_rate: 22 }),
    method: 'POST',
    path: '/p1/billing/milestones/m1',
    body: { tax_rate: 22 },
  },
  {
    name: 'billTimeAndMaterials',
    call: (s) => s.billTimeAndMaterials('p1', { tax_rate: 22, up_to_date: '2026-11-30' }),
    method: 'POST',
    path: '/p1/billing/time-and-materials',
    body: { tax_rate: 22, up_to_date: '2026-11-30' },
  },
  { name: 'getBillingEvents', call: (s) => s.getBillingEvents('p1'), method: 'GET', path: '/p1/billing-events' },
  { name: 'getRevenueRecognitions', call: (s) => s.getRevenueRecognitions('p1'), method: 'GET', path: '/p1/revenue-recognitions' },
  {
    name: 'runRevenueRecognition',
    call: (s) => s.runRevenueRecognition('p1', { accounting_period_date: '2026-11-30' }),
    method: 'POST',
    path: '/p1/revenue-recognitions',
    body: { accounting_period_date: '2026-11-30' },
  },
  { name: 'getCosts', call: (s) => s.getCosts('p1', { approval_status: 'pending' }), method: 'GET', path: '/p1/costs', params: { approval_status: 'pending' } },
  {
    name: 'createCost',
    call: (s) =>
      s.createCost('p1', { cost_category: 'material', cost_source_type: 'manual', cost_source_id: 's1', quantity: 2, unit_cost: 5, incurred_date: '2026-11-01' }),
    method: 'POST',
    path: '/p1/costs',
    body: { cost_category: 'material', cost_source_type: 'manual', cost_source_id: 's1', quantity: 2, unit_cost: 5, incurred_date: '2026-11-01' },
  },
  {
    name: 'createExpense',
    call: (s) => s.createExpense('p1', { expense_category: 'travel_lodging', description: 'Hotel', amount: 120, incurred_date: '2026-11-01' }),
    method: 'POST',
    path: '/p1/expenses',
    body: { expense_category: 'travel_lodging', description: 'Hotel', amount: 120, incurred_date: '2026-11-01' },
  },
  { name: 'approveExpense', call: (s) => s.approveExpense('e1'), method: 'POST', path: '/expenses/e1/approve', body: {} },
  { name: 'rejectExpense', call: (s) => s.rejectExpense('e1', 'no receipt'), method: 'POST', path: '/expenses/e1/reject', body: { reason: 'no receipt' } },
  { name: 'getForecast', call: (s) => s.getForecast('p1'), method: 'GET', path: '/p1/forecast' },
  { name: 'getProfitability', call: (s) => s.getProfitability('p1'), method: 'GET', path: '/p1/profitability' },
  { name: 'getClosureChecks', call: (s) => s.getClosureChecks('p1'), method: 'GET', path: '/p1/closure-checks' },
  { name: 'getEvmSnapshots', call: (s) => s.getEvmSnapshots('p1'), method: 'GET', path: '/p1/evm-snapshots' },
  { name: 'getAuditTrail', call: (s) => s.getAuditTrail('p1', 'budget_approved'), method: 'GET', path: '/p1/audit-trail', params: { event_type: 'budget_approved' } },
  { name: 'getGantt', call: (s) => s.getGantt('p1'), method: 'GET', path: '/p1/gantt' },
  { name: 'getCriticalPath', call: (s) => s.getCriticalPath('p1'), method: 'GET', path: '/p1/critical-path' },
  { name: 'baselineSchedule', call: (s) => s.baselineSchedule('p1'), method: 'POST', path: '/p1/schedule/baseline', body: {} },
  {
    name: 'addTaskDependency',
    call: (s) => s.addTaskDependency('t1', { predecessor_task_id: 't0', dependency_type: 'finish_to_start', lag_days: 1 }),
    method: 'POST',
    path: '/tasks/t1/dependencies',
    body: { predecessor_task_id: 't0', dependency_type: 'finish_to_start', lag_days: 1 },
  },
  { name: 'removeTaskDependency', call: (s) => s.removeTaskDependency('d1'), method: 'DELETE', path: '/task-dependencies/d1' },
  {
    name: 'assignTask',
    call: (s) => s.assignTask('t1', { user_id: 'u1', allocated_hours: 8 }),
    method: 'POST',
    path: '/tasks/t1/assignments',
    body: { user_id: 'u1', allocated_hours: 8 },
  },
  { name: 'removeTaskAssignment', call: (s) => s.removeTaskAssignment('a1'), method: 'DELETE', path: '/task-assignments/a1' },
  { name: 'getResources', call: (s) => s.getResources(), method: 'GET', path: '/resources' },
  {
    name: 'updateResource',
    call: (s) => s.updateResource('u1', { internal_hourly_cost: 30, billing_hourly_rate: 60, weekly_capacity_hours: 40 }),
    method: 'PUT',
    path: '/resources/u1',
    body: { internal_hourly_cost: 30, billing_hourly_rate: 60, weekly_capacity_hours: 40 },
  },
  {
    name: 'getResourceCapacity',
    call: (s) => s.getResourceCapacity({ from: '2026-11-01', to: '2026-11-30' }),
    method: 'GET',
    path: '/resource-capacity',
    params: { from: '2026-11-01', to: '2026-11-30' },
  },
  { name: 'getRateCards', call: (s) => s.getRateCards({ project_id: 'p1' }), method: 'GET', path: '/rate-cards', params: { project_id: 'p1' } },
  {
    name: 'createRateCard',
    call: (s) => s.createRateCard({ role: 'Developer', cost_rate: 30, bill_rate: 70 }),
    method: 'POST',
    path: '/rate-cards',
    body: { role: 'Developer', cost_rate: 30, bill_rate: 70 },
  },
  { name: 'deleteRateCard', call: (s) => s.deleteRateCard('r1'), method: 'DELETE', path: '/rate-cards/r1' },
];

describe('ProjectControlApiService', () => {
  let service: ProjectControlApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/projects`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProjectControlApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjectControlApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(CASES)('$name sends $method $path', (c) => {
    c.call(service).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}${c.path}`);
    expect(req.request.method).toBe(c.method);
    for (const [key, value] of Object.entries(c.params ?? {})) {
      expect(req.request.params.get(key)).toBe(value);
    }
    if (c.body !== undefined) {
      expect(req.request.body).toEqual(c.body);
    }
    req.flush({ data: {}, meta: {} });
  });
});
