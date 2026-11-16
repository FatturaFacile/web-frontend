import { Routes } from '@angular/router';
import { LoanerStore } from './state/loaner.store';
import { PassportStore } from './state/passport.store';
import { RmaBoardStore } from './state/rma-board.store';
import { RmaDetailStore } from './state/rma-detail.store';
import { SerialLookupStore } from './state/serial-lookup.store';
import { VendorClaimStore } from './state/vendor-claim.store';

export const WARRANTY_RMA_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'bench',
  },
  {
    path: 'lookup',
    data: { breadcrumb: 'Verifica garanzia', title: 'Verifica garanzia' },
    providers: [SerialLookupStore],
    loadComponent: () =>
      import('./components/serial-lookup/serial-lookup.component').then(
        (m) => m.SerialLookupComponent,
      ),
  },
  {
    path: 'bench',
    data: { breadcrumb: 'Banco riparazioni', title: 'Banco riparazioni RMA' },
    providers: [RmaBoardStore, RmaDetailStore],
    loadComponent: () =>
      import('./components/rma-board/rma-board.component').then((m) => m.RmaBoardComponent),
  },
  {
    path: 'passports',
    data: { breadcrumb: 'Passaporti apparecchi', title: 'Passaporti apparecchi' },
    providers: [PassportStore],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/passport-list/passport-list.component').then(
            (m) => m.PassportListComponent,
          ),
      },
      {
        path: ':id',
        data: { breadcrumb: 'Dettaglio passaporto', title: 'Passaporto apparecchio' },
        loadComponent: () =>
          import('./components/passport-detail/passport-detail.component').then(
            (m) => m.PassportDetailComponent,
          ),
      },
    ],
  },
  {
    path: 'loaners',
    data: { breadcrumb: 'Registro muletti', title: 'Registro apparecchi sostitutivi' },
    providers: [LoanerStore],
    loadComponent: () =>
      import('./components/loaner-register/loaner-register.component').then(
        (m) => m.LoanerRegisterComponent,
      ),
  },
  {
    path: 'vendor-claims',
    data: { breadcrumb: 'Rivalse fornitori', title: 'Rivalse in garanzia fornitori' },
    providers: [VendorClaimStore],
    loadComponent: () =>
      import('./components/vendor-claims/vendor-claims.component').then(
        (m) => m.VendorClaimsComponent,
      ),
  },
];
