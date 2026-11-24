import { Observable, switchMap, takeWhile, timer } from 'rxjs';
import type { PgDsar, PgItem } from '@core';

/** Whether the portability package will not change any more (ready to download, or failed). */
export function isPackageSettled(dsar: Pick<PgDsar, 'package_status'>): boolean {
  return dsar.package_status === 'ready' || dsar.package_status === 'failed';
}

/**
 * Polls the request until its portability package is ready or failed; emits every state it reads and completes after the
 * settled one. Unsubscribe to stop.
 */
export function pollDsarPackage(
  fetch: () => Observable<PgItem<PgDsar>>,
  intervalMs = 2000,
): Observable<PgDsar> {
  return timer(intervalMs, intervalMs).pipe(
    switchMap(() => fetch()),
    switchMap((response) => [response.data]),
    takeWhile((dsar) => !isPackageSettled(dsar), true),
  );
}
