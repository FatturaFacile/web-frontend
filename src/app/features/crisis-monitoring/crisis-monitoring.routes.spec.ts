import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { CRISIS_MONITORING_ROUTES } from './crisis-monitoring.routes';
import { CRISIS_MODULE } from './crisis-monitoring.util';

describe('crisis monitoring routes', () => {
  it('lazy loads the workspace with its own store', async () => {
    const [root] = CRISIS_MONITORING_ROUTES;
    const page = root.children?.[0];

    expect(root.providers).toHaveLength(1);
    expect(typeof page?.loadComponent).toBe('function');
    expect(await (page?.loadComponent as () => Promise<unknown>)()).toBeDefined();
  });
});

describe('crisis monitoring navigation', () => {
  const entry = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.CRISIS_MONITORING',
  );

  it('has a menu entry guarded by the module', () => {
    expect(entry?.route).toBe('/crisis-monitoring');
    expect(entry?.module).toBe(CRISIS_MODULE);
    expect(isUrlOfEnabledMenuRoute('/crisis-monitoring')).toBe(true);
    expect(moduleOfUrl('/crisis-monitoring')).toBe(CRISIS_MODULE);
  });

  it('lets finance maintain it and the read-only accountant read', () => {
    expect(canAccessModule(CRISIS_MODULE, 'read', ['accountant_readonly'])).toBe(true);
    expect(canAccessModule(CRISIS_MODULE, 'write', ['accountant_readonly'])).toBe(false);
    expect(canAccessModule(CRISIS_MODULE, 'write', ['accountant'])).toBe(true);
    expect(canAccessModule(CRISIS_MODULE, 'read', ['warehouse'])).toBe(false);
  });
});
