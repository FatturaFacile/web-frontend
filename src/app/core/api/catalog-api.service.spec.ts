import { describeApiCases } from '../../../testing/api-cases';
import { CatalogApiService } from './catalog-api.service';

const term = { code: '30DF', name: '30 days', days: 30, sdi_terms_code: 'TP02' as const };

describeApiCases('CatalogApiService', CatalogApiService, [
  { name: 'getPaymentTerms', call: (s) => s.getPaymentTerms(), method: 'GET', path: '/catalog/payment-terms' },
  { name: 'getPaymentTerm', call: (s) => s.getPaymentTerm('t1'), method: 'GET', path: '/catalog/payment-terms/t1' },
  {
    name: 'getPaymentTermSchedule',
    call: (s) => s.getPaymentTermSchedule('t1', { amount: '1000.00', date: '2026-11-09' }),
    method: 'GET',
    path: '/catalog/payment-terms/t1/schedule',
    params: { amount: '1000.00', date: '2026-11-09' },
  },
  { name: 'createPaymentTerm', call: (s) => s.createPaymentTerm(term), method: 'POST', path: '/catalog/payment-terms', body: term },
  { name: 'updatePaymentTerm', call: (s) => s.updatePaymentTerm('t1', term), method: 'PUT', path: '/catalog/payment-terms/t1', body: term },
  { name: 'deletePaymentTerm', call: (s) => s.deletePaymentTerm('t1'), method: 'DELETE', path: '/catalog/payment-terms/t1' },
  { name: 'getBrands', call: (s) => s.getBrands(), method: 'GET', path: '/catalog/brands' },
  { name: 'getBrand', call: (s) => s.getBrand('b1'), method: 'GET', path: '/catalog/brands/b1' },
  { name: 'createBrand', call: (s) => s.createBrand('Acme'), method: 'POST', path: '/catalog/brands', body: { name: 'Acme' } },
  { name: 'updateBrand', call: (s) => s.updateBrand('b1', 'Acme 2'), method: 'PUT', path: '/catalog/brands/b1', body: { name: 'Acme 2' } },
  { name: 'deleteBrand', call: (s) => s.deleteBrand('b1'), method: 'DELETE', path: '/catalog/brands/b1' },
  { name: 'getCategories', call: (s) => s.getCategories(), method: 'GET', path: '/catalog/categories' },
  { name: 'getCategory', call: (s) => s.getCategory('c1'), method: 'GET', path: '/catalog/categories/c1' },
  { name: 'createCategory', call: (s) => s.createCategory({ name: 'Tools', parent_id: 'c0' }), method: 'POST', path: '/catalog/categories', body: { name: 'Tools', parent_id: 'c0' } },
  { name: 'updateCategory', call: (s) => s.updateCategory('c1', { name: 'Tools' }), method: 'PUT', path: '/catalog/categories/c1', body: { name: 'Tools' } },
  { name: 'deleteCategory', call: (s) => s.deleteCategory('c1'), method: 'DELETE', path: '/catalog/categories/c1' },
  { name: 'getUnits', call: (s) => s.getUnits(), method: 'GET', path: '/catalog/units' },
  { name: 'getUnit', call: (s) => s.getUnit('u1'), method: 'GET', path: '/catalog/units/u1' },
  { name: 'createUnit', call: (s) => s.createUnit({ code: 'KG', name: 'Kilogram' }), method: 'POST', path: '/catalog/units', body: { code: 'KG', name: 'Kilogram' } },
  { name: 'updateUnit', call: (s) => s.updateUnit('u1', { code: 'KG', name: 'Kilo' }), method: 'PUT', path: '/catalog/units/u1', body: { code: 'KG', name: 'Kilo' } },
  { name: 'deleteUnit', call: (s) => s.deleteUnit('u1'), method: 'DELETE', path: '/catalog/units/u1' },
]);
