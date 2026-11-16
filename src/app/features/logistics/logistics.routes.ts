import { Routes } from '@angular/router';
import { LOGISTICS_PERMISSIONS as P, permissionGuard } from '@core';

/**
 * Logistics routes. Every route is protected by a functional guard that awaits the permission hydration, so direct
 * URL navigation and cold refresh (F5) enforce RBAC without flashing unauthorized content.
 */
export const LOGISTICS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'delivery-notes' },
  {
    path: 'delivery-notes',
    canActivate: [permissionGuard(P.view)],
    data: { breadcrumb: 'Documenti di trasporto', title: 'Documenti di trasporto' },
    loadComponent: () =>
      import('./components/delivery-notes/delivery-notes.component').then(
        (m) => m.DeliveryNotesComponent,
      ),
  },
  {
    path: 'delivery-notes/new',
    canActivate: [permissionGuard(P.create)],
    data: { breadcrumb: 'Nuovo DDT', title: 'Nuovo DDT' },
    loadComponent: () =>
      import('./components/delivery-notes/delivery-note-editor.component').then(
        (m) => m.DeliveryNoteEditorComponent,
      ),
  },
  {
    path: 'delivery-notes/:id/edit',
    canActivate: [permissionGuard(P.update)],
    data: { breadcrumb: 'Modifica DDT', title: 'Modifica DDT' },
    loadComponent: () =>
      import('./components/delivery-notes/delivery-note-editor.component').then(
        (m) => m.DeliveryNoteEditorComponent,
      ),
  },
  {
    path: 'transfers',
    canActivate: [permissionGuard(P.transfers)],
    data: { breadcrumb: 'Trasferimenti interni', title: 'Trasferimenti interni' },
    loadComponent: () =>
      import('./components/transfers/transfers.component').then((m) => m.TransfersComponent),
  },
  {
    path: 'consignment',
    canActivate: [permissionGuard(P.view)],
    data: { breadcrumb: 'Conto deposito', title: 'Conto deposito e terzisti' },
    loadComponent: () =>
      import('./components/consignment/consignment.component').then((m) => m.ConsignmentComponent),
  },
];
