import { Pipe, PipeTransform } from '@angular/core';

/** Comparator for `[nzSortFn]` on a column: `'user.name' | gridSort` sorts rows by that property path. */
@Pipe({ name: 'gridSort' })
export class GridSortPipe implements PipeTransform {
  transform(path: string): (a: unknown, b: unknown) => number {
    const read = (row: unknown): unknown =>
      path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | null | undefined)?.[key], row);
    return (a, b) => {
      const x = read(a);
      const y = read(b);
      const xEmpty = x === null || x === undefined || x === '';
      const yEmpty = y === null || y === undefined || y === '';
      if (xEmpty || yEmpty) {
        return xEmpty === yEmpty ? 0 : xEmpty ? 1 : -1;
      }
      if (typeof x === 'number' && typeof y === 'number') {
        return x - y;
      }
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
    };
  }
}
