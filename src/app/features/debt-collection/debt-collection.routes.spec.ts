import { describe, expect, it } from 'vitest';
import { DEBT_COLLECTION_ROUTES } from './debt-collection.routes';

describe('DEBT_COLLECTION_ROUTES', () => {
  it('opens the workbench at the root of the module', () => {
    expect(DEBT_COLLECTION_ROUTES.map((route) => route.path)).toEqual(['']);
  });

  it('lazy loads a standalone component', async () => {
    const [route] = DEBT_COLLECTION_ROUTES;

    expect(route?.loadComponent).toBeTypeOf('function');
    const component = await (route?.loadComponent as () => Promise<unknown>)();
    expect(component).toBeTruthy();
  });

  it('gives the page a breadcrumb and a title from the debtCollection namespace', () => {
    expect(DEBT_COLLECTION_ROUTES[0]?.data?.['breadcrumb']).toBe('debtCollection.nav.title');
    expect(DEBT_COLLECTION_ROUTES[0]?.data?.['title']).toBe('debtCollection.title');
  });
});
