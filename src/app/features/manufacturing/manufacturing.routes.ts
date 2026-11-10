import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { MFG_ENGINEERING_PAGE } from './engineering.page';
import { MFG_PLANNING_PAGE, MFG_QUALITY_PAGE } from './planning-quality.page';
import { MFG_PRODUCTION_PAGE } from './production.page';

const manufacturingRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  component: ResourcePageComponent,
});

export const MANUFACTURING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.PRODUZIONE_AND_MRP', title: 'Produzione & MRP' },
    loadComponent: () =>
      import('./manufacturing.component').then((m) => m.ManufacturingComponent),
  },
  manufacturingRoute('engineering', 'Anagrafiche & Distinte', MFG_ENGINEERING_PAGE),
  manufacturingRoute('production', 'Ordini & Esecuzione', MFG_PRODUCTION_PAGE),
  manufacturingRoute('quality', 'Qualità', MFG_QUALITY_PAGE),
  manufacturingRoute('planning', 'Pianificazione & KPI', MFG_PLANNING_PAGE),
];
