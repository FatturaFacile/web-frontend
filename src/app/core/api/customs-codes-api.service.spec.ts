import { describeApiCases } from '../../../testing/api-cases';
import { CustomsCodesApiService } from './customs-codes-api.service';

const code = { code: '847130', description: { en: 'Portable computers' } };
const agreement = {
  code: 'CH-EU',
  name: { en: 'Switzerland - EU' },
  partner_countries: ['CH', 'IT'],
  proof_types: ['EUR.1'],
  declaration_templates: { en: 'text' },
  declaration_templates_no_auth: { en: 'text' },
};

describeApiCases('CustomsCodesApiService', CustomsCodesApiService, [
  {
    name: 'getTaricCodes',
    call: (s) => s.getTaricCodes({ search: '8471', level: 'HS6', per_page: 20 }),
    method: 'GET',
    path: '/catalog/customs-taric-codes',
    params: { search: '8471', level: 'HS6', per_page: '20' },
  },
  { name: 'getTaricCode', call: (s) => s.getTaricCode('t1'), method: 'GET', path: '/catalog/customs-taric-codes/t1' },
  { name: 'createTaricCode', call: (s) => s.createTaricCode(code), method: 'POST', path: '/catalog/customs-taric-codes', body: code },
  { name: 'updateTaricCode', call: (s) => s.updateTaricCode('t1', { is_active: false }), method: 'PUT', path: '/catalog/customs-taric-codes/t1', body: { is_active: false } },
  { name: 'deleteTaricCode', call: (s) => s.deleteTaricCode('t1'), method: 'DELETE', path: '/catalog/customs-taric-codes/t1' },
  { name: 'getFreeTradeAgreements', call: (s) => s.getFreeTradeAgreements({ is_active: true }), method: 'GET', path: '/catalog/free-trade-agreements', params: { is_active: 'true' } },
  { name: 'getFreeTradeAgreement', call: (s) => s.getFreeTradeAgreement('a1'), method: 'GET', path: '/catalog/free-trade-agreements/a1' },
  { name: 'createFreeTradeAgreement', call: (s) => s.createFreeTradeAgreement(agreement), method: 'POST', path: '/catalog/free-trade-agreements', body: agreement },
  { name: 'updateFreeTradeAgreement', call: (s) => s.updateFreeTradeAgreement('a1', { notes: 'x' }), method: 'PUT', path: '/catalog/free-trade-agreements/a1', body: { notes: 'x' } },
  { name: 'deleteFreeTradeAgreement', call: (s) => s.deleteFreeTradeAgreement('a1'), method: 'DELETE', path: '/catalog/free-trade-agreements/a1' },
  {
    name: 'evaluateInvoiceOrigin',
    call: (s) => s.evaluateInvoiceOrigin('i1', { locale: 'de', apply: false }),
    method: 'POST',
    path: '/sales/invoices/i1/evaluate-customs-origin',
    body: { locale: 'de', apply: false },
  },
]);
