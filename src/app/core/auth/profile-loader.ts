import { inject } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { AuthApiService } from '../api/auth-api.service';
import { AuthStore } from './auth.store';

/** The request of the full profile, shared by every guard that waits for it, per user object of the store. */
const requests = new WeakMap<object, Observable<void>>();

/**
 * The login answer carries no role or permissions of the tenants, so the menu and the module guards would take every
 * member for a plain `member`. When the store holds such a user, this loads the full profile once (every guard of the
 * navigation waits for the same request); it returns `null` when the profile is already complete. A failure keeps
 * the session: the error interceptor handles a 401.
 *
 * Must be called in an injection context.
 */
export function loadFullProfileIfNeeded(): Observable<void> | null {
  const authStore = inject(AuthStore);
  const authApi = inject(AuthApiService);
  const user = authStore.user();

  if (!authStore.isAuthenticated() || !user || user.active_tenant || user.tenants) {
    return null;
  }

  let request = requests.get(user);
  if (!request) {
    request = authApi.me().pipe(
      tap((res) => authStore.updateProfile(res.data)),
      map(() => undefined),
      catchError(() => of(undefined)),
      shareReplay(1),
    );
    requests.set(user, request);
  }
  return request;
}
