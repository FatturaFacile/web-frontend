import { Routes } from '@angular/router';

export const FLEET_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.FLEET_DASHBOARD', title: 'PAGE_TITLE.FLEET_DASHBOARD' },
    loadComponent: () => import('./fleet-dashboard.component').then((m) => m.FleetDashboardComponent),
  },
  {
    path: 'vehicles',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.FLEET_VEHICLES', title: 'PAGE_TITLE.FLEET_VEHICLES' },
    loadComponent: () => import('./fleet-vehicles.component').then((m) => m.FleetVehiclesComponent),
  },
  {
    path: 'vehicles/:id',
    data: { breadcrumb: 'NAV.FLEET_VEHICLE', title: 'PAGE_TITLE.FLEET_VEHICLE' },
    loadComponent: () => import('./fleet-vehicle-detail.component').then((m) => m.FleetVehicleDetailComponent),
  },
  {
    path: 'assignments',
    data: { breadcrumb: 'NAV.FLEET_ASSIGNMENTS', title: 'PAGE_TITLE.FLEET_ASSIGNMENTS' },
    loadComponent: () => import('./fleet-assignments.component').then((m) => m.FleetAssignmentsComponent),
  },
  {
    path: 'fuel',
    data: { breadcrumb: 'NAV.FLEET_FUEL', title: 'PAGE_TITLE.FLEET_FUEL' },
    loadComponent: () => import('./fleet-fuel.component').then((m) => m.FleetFuelComponent),
  },
  {
    path: 'services',
    data: { breadcrumb: 'NAV.FLEET_SERVICES', title: 'PAGE_TITLE.FLEET_SERVICES' },
    loadComponent: () => import('./fleet-services.component').then((m) => m.FleetServicesComponent),
  },
  {
    path: 'deadlines',
    data: { breadcrumb: 'NAV.FLEET_DEADLINES', title: 'PAGE_TITLE.FLEET_DEADLINES' },
    loadComponent: () => import('./fleet-deadlines.component').then((m) => m.FleetDeadlinesComponent),
  },
  {
    path: 'fines',
    data: { breadcrumb: 'NAV.FLEET_FINES', title: 'PAGE_TITLE.FLEET_FINES' },
    loadComponent: () => import('./fleet-fines.component').then((m) => m.FleetFinesComponent),
  },
];
