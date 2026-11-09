import { describeApiCases } from '../../../testing/api-cases';
import { SubscriptionApiService } from './subscription-api.service';

describeApiCases('SubscriptionApiService (lifecycle, usage, billing runs, revenue)', SubscriptionApiService, [
  { name: 'upgradeContract', call: (s) => s.upgradeContract('c1', { new_plan_id: 'p2', quantity: '3' }), method: 'POST', path: '/sub/contracts/c1/upgrade', body: { new_plan_id: 'p2', quantity: '3' } },
  { name: 'downgradeContract', call: (s) => s.downgradeContract('c1', { new_plan_id: 'p1' }), method: 'POST', path: '/sub/contracts/c1/downgrade', body: { new_plan_id: 'p1' } },
  { name: 'changeContractQuantity', call: (s) => s.changeContractQuantity('c1', { quantity: '10', reason: 'Growth' }), method: 'POST', path: '/sub/contracts/c1/quantity', body: { quantity: '10', reason: 'Growth' } },
  { name: 'getProrationPreview', call: (s) => s.getProrationPreview('c1', { new_plan_id: 'p2', quantity: '2' }), method: 'GET', path: '/sub/contracts/c1/proration-preview', params: { new_plan_id: 'p2', quantity: '2' } },
  { name: 'suspendContract', call: (s) => s.suspendContract('c1', { reason: 'Unpaid', resume_on: '2026-12-01' }), method: 'POST', path: '/sub/contracts/c1/suspend', body: { reason: 'Unpaid', resume_on: '2026-12-01' } },
  { name: 'recordCollectionFailure', call: (s) => s.recordCollectionFailure('c1', { invoice_id: 'inv1' }), method: 'POST', path: '/sub/contracts/c1/collection-failures', body: { invoice_id: 'inv1' } },
  { name: 'getContractDunning', call: (s) => s.getContractDunning('c1'), method: 'GET', path: '/sub/contracts/c1/dunning' },
  {
    name: 'recordUsage',
    call: (s) => s.recordUsage({ subscription_item_id: 'si1', metric_code: 'api_calls', quantity: '100', idempotency_key: 'k1' }),
    method: 'POST',
    path: '/subscriptions/usage',
    body: { subscription_item_id: 'si1', metric_code: 'api_calls', quantity: '100', idempotency_key: 'k1' },
  },
  { name: 'getUsageEvents', call: (s) => s.getUsageEvents({ page: 2 }), method: 'GET', path: '/subscriptions/usage', params: { page: '2' } },
  { name: 'getBillingRuns', call: (s) => s.getBillingRuns(), method: 'GET', path: '/subscriptions/billing-runs' },
  { name: 'getBillingRun', call: (s) => s.getBillingRun('br1'), method: 'GET', path: '/subscriptions/billing-runs/br1' },
  { name: 'runBilling', call: (s) => s.runBilling({ lookahead_days: 5 }), method: 'POST', path: '/subscriptions/billing-runs', body: { lookahead_days: 5 } },
  { name: 'getRevenueContracts', call: (s) => s.getRevenueContracts(), method: 'GET', path: '/subscriptions/revenue-contracts' },
  { name: 'getRevenueContract', call: (s) => s.getRevenueContract('rc1'), method: 'GET', path: '/subscriptions/revenue-contracts/rc1' },
  { name: 'recognizeRevenue', call: (s) => s.recognizeRevenue('2026-11-30'), method: 'POST', path: '/subscriptions/revenue-recognition/recognize', body: { period_date: '2026-11-30' } },
  { name: 'getSubscriptionForecast', call: (s) => s.getSubscriptionForecast(6), method: 'GET', path: '/subscriptions/forecast', params: { months: '6' } },
]);
