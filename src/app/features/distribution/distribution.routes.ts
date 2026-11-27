import { Routes } from '@angular/router';

/** Distribution, multi-warehouse and transfers (DRP, Issue #271). The parent route guards the module (see `app.routes.ts`). */
export const DISTRIBUTION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    data: { breadcrumb: 'NAV.DISTRIBUTION_OVERVIEW', title: 'PAGE_TITLE.DISTRIBUTION_OVERVIEW' },
    loadComponent: () => import('./overview.component').then((m) => m.OverviewComponent),
  },
  {
    path: 'network',
    data: { breadcrumb: 'NAV.DISTRIBUTION_NETWORK', title: 'PAGE_TITLE.DISTRIBUTION_NETWORK' },
    loadComponent: () => import('./network.component').then((m) => m.NetworkComponent),
  },
  {
    path: 'transfers',
    data: { breadcrumb: 'NAV.DISTRIBUTION_TRANSFERS', title: 'PAGE_TITLE.DISTRIBUTION_TRANSFERS' },
    loadComponent: () => import('./transfers.component').then((m) => m.TransfersComponent),
  },
  {
    path: 'in-transit',
    data: {
      breadcrumb: 'NAV.DISTRIBUTION_IN_TRANSIT',
      title: 'PAGE_TITLE.DISTRIBUTION_IN_TRANSIT',
    },
    loadComponent: () => import('./in-transit.component').then((m) => m.InTransitComponent),
  },
  {
    path: 'replenishment',
    data: {
      breadcrumb: 'NAV.DISTRIBUTION_REPLENISHMENT',
      title: 'PAGE_TITLE.DISTRIBUTION_REPLENISHMENT',
    },
    loadComponent: () => import('./replenishment.component').then((m) => m.ReplenishmentComponent),
  },
  {
    path: 'proposals',
    data: { breadcrumb: 'NAV.DISTRIBUTION_PROPOSALS', title: 'PAGE_TITLE.DISTRIBUTION_PROPOSALS' },
    loadComponent: () => import('./proposals.component').then((m) => m.ProposalsComponent),
  },
  {
    path: 'drp',
    data: { breadcrumb: 'NAV.DISTRIBUTION_DRP', title: 'PAGE_TITLE.DISTRIBUTION_DRP' },
    loadComponent: () => import('./drp.component').then((m) => m.DrpComponent),
  },
  {
    path: 'consignment',
    data: {
      breadcrumb: 'NAV.DISTRIBUTION_CONSIGNMENT',
      title: 'PAGE_TITLE.DISTRIBUTION_CONSIGNMENT',
    },
    loadComponent: () => import('./consignment.component').then((m) => m.ConsignmentComponent),
  },
  {
    path: 'channels',
    data: { breadcrumb: 'NAV.DISTRIBUTION_CHANNELS', title: 'PAGE_TITLE.DISTRIBUTION_CHANNELS' },
    loadComponent: () => import('./channels.component').then((m) => m.ChannelsComponent),
  },
  {
    path: 'atp',
    data: { breadcrumb: 'NAV.DISTRIBUTION_ATP', title: 'PAGE_TITLE.DISTRIBUTION_ATP' },
    loadComponent: () => import('./atp.component').then((m) => m.AtpComponent),
  },
];
