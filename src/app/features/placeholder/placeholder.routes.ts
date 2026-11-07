import { Route, Routes } from '@angular/router';

/** Builds a lazy route that renders the generic placeholder page with the given title key. */
export function placeholderRoute(path: string, titleKey: string): Route {
  return {
    path,
    data: { breadcrumb: titleKey, titleKey },
    loadComponent: () =>
      import('./placeholder-page.component').then((m) => m.PlaceholderPageComponent),
  };
}

export function placeholderRoutes(entries: readonly (readonly [path: string, titleKey: string])[]): Routes {
  return entries.map(([path, titleKey]) => placeholderRoute(path, titleKey));
}
