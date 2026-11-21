import { Route, Routes } from '@angular/router';
import { MFG_ENGINEERING_PAGE } from './engineering.page';
import { MFG_PLANNING_PAGE, MFG_QUALITY_PAGE } from './planning-quality.page';
import { MFG_PRODUCTION_PAGE } from './production.page';

const manufacturingRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
});

const bomRoute = (path: string, titleKey: string, loadComponent: Route['loadComponent']): Route => ({
  path,
  data: { breadcrumb: titleKey, title: titleKey },
  loadComponent,
});

export const MANUFACTURING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.PRODUZIONE_AND_MRP', title: 'PAGE_TITLE.PRODUZIONE_MRP' },
    loadComponent: () =>
      import('./manufacturing.component').then((m) => m.ManufacturingComponent),
  },
  manufacturingRoute('engineering', 'Anagrafiche & Distinte', MFG_ENGINEERING_PAGE),
  manufacturingRoute('production', 'Ordini & Esecuzione', MFG_PRODUCTION_PAGE),
  manufacturingRoute('quality', 'Qualità', MFG_QUALITY_PAGE),
  manufacturingRoute('planning', 'Pianificazione & KPI', MFG_PLANNING_PAGE),
  bomRoute('bom-designer', 'MFG_BOM.DESIGNER_TITLE', () =>
    import('./bom/bom-designer.component').then((m) => m.BomDesignerComponent),
  ),
  bomRoute('where-used', 'MFG_BOM.WHERE_USED_TITLE', () =>
    import('./bom/where-used.component').then((m) => m.WhereUsedComponent),
  ),
  bomRoute('bom-diff', 'MFG_BOM.DIFF_TITLE', () => import('./bom/bom-diff.page').then((m) => m.BomDiffPageComponent)),
  bomRoute('bom-import', 'MFG_BOM.IMPORT_TITLE', () =>
    import('./bom/bom-import-wizard.component').then((m) => m.BomImportWizardComponent),
  ),
];
