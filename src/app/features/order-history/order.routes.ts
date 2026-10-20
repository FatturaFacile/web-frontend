import { Routes } from '@angular/router';
import { ORDER_REPOSITORY } from '@domain/repositories/order.repository';
import { OrderHttpRepository } from '@data-access/repositories/order-http.repository';
import { OrderStore } from './state/order.store';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: ORDER_REPOSITORY, useClass: OrderHttpRepository },
      OrderStore,
    ],
    loadComponent: () =>
      import('./components/order-list/order-list.component').then(
        (m) => m.OrderListComponent
      ),
  },
];
