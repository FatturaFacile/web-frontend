import { Routes } from '@angular/router';
import { placeholderRoutes } from '../placeholder';

export const SECTORS_ROUTES: Routes = placeholderRoutes([
  ['sme', 'NAV.SECTOR_SME'],
  ['mechanic', 'NAV.SECTOR_MECHANIC'],
  ['craft-lab', 'NAV.SECTOR_CRAFT'],
]);
