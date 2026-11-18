import { describeApiCases } from '../../../testing/api-cases';
import { ForeignTradeApiService } from './foreign-trade-api.service';

const request = { incoterm: 'EXW', goods_value: 1000, freight: 80, insurance: 20 } as const;

describeApiCases('ForeignTradeApiService', ForeignTradeApiService, [
  {
    name: 'calculateCustomsValue',
    call: (s) => s.calculateCustomsValue(request),
    method: 'POST',
    path: '/foreign-trade/customs-value',
    body: request,
  },
  {
    name: 'getInvoiceReadiness',
    call: (s) => s.getInvoiceReadiness('inv-1'),
    method: 'GET',
    path: '/sales/invoices/inv-1/cross-border-readiness',
  },
]);
