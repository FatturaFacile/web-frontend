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
    data: { breadcrumb: 'RMA.NAV.LOOKUP', title: 'RMA.NAV.LOOKUP' },
    providers: [SerialLookupStore],
    loadComponent: () =>
      import('./components/serial-lookup/serial-lookup.component').then(
        (m) => m.SerialLookupComponent,
      ),
  },
  {
    path: 'bench',
    data: { breadcrumb: 'RMA.NAV.BENCH', title: 'RMA.NAV.BENCH' },
    providers: [RmaBoardStore, RmaDetailStore],
    loadComponent: () =>
      import('./components/rma-board/rma-board.component').then((m) => m.RmaBoardComponent),
  },
  {
    path: 'passports',
    data: { breadcrumb: 'RMA.NAV.PASSPORTS', title: 'RMA.NAV.PASSPORTS' },
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
        data: { breadcrumb: 'RMA.NAV.PASSPORT_DETAIL', title: 'RMA.NAV.PASSPORT_DETAIL' },
        loadComponent: () =>
          import('./components/passport-detail/passport-detail.component').then(
            (m) => m.PassportDetailComponent,
          ),
      },
    ],
  },
  {
    path: 'loaners',
    data: { breadcrumb: 'RMA.NAV.LOANERS', title: 'RMA.NAV.LOANERS' },
    providers: [LoanerStore],
    loadComponent: () =>
      import('./components/loaner-register/loaner-register.component').then(
        (m) => m.LoanerRegisterComponent,
      ),
  },
  {
    path: 'vendor-claims',
    data: { breadcrumb: 'RMA.NAV.VENDOR_CLAIMS', title: 'RMA.NAV.VENDOR_CLAIMS' },
    providers: [VendorClaimStore],
    loadComponent: () =>
      import('./components/vendor-claims/vendor-claims.component').then(
        (m) => m.VendorClaimsComponent,
      ),
  },
];
