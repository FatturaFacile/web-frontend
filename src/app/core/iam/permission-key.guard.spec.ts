import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { permissionKeyGuard } from './permission-key.guard';
import { PermissionStore } from './permission.store';

describe('permissionKeyGuard', () => {
  const run = async (granted: string[]): Promise<boolean | UrlTree> => {
    const load = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionStore, useValue: { load, hasAnyPermission: (keys: string[]) => keys.some((k) => granted.includes(k)) } },
      ],
    });
    const guard = permissionKeyGuard('settings.roles.view', 'settings.roles.update');
    const result = await TestBed.runInInjectionContext(() => guard({} as never, [] as never) as Promise<boolean | UrlTree>);
    expect(load).toHaveBeenCalledOnce();
    return result;
  };

  it('lets the route through when any of the keys is held, after loading the snapshot', async () => {
    expect(await run(['settings.roles.update'])).toBe(true);
  });

  it('redirects to the dashboard when none is held', async () => {
    const result = await run([]);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
