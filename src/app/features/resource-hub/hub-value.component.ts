import { Component, computed, input } from '@angular/core';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';

type Json = Record<string, unknown>;

const HIDDEN = new Set(['tenant_id', 'deleted_at', 'updated_at']);

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Text of a cell: scalars as they are, nested values summarised. */
export function hubCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Sì' : 'No';
  }
  if (Array.isArray(value)) {
    return `${value.length} elementi`;
  }
  if (isObject(value)) {
    const label = value['name'] ?? value['title'] ?? value['label'] ?? value['code'] ?? value['number'];
    return label !== undefined ? String(label) : '…';
  }
  return String(value);
}

/**
 * Shows any answer of the API: the `data` of an envelope is unwrapped, a list becomes a table and an object a
 * description list; nested lists/objects of an object are shown as further tables.
 */
@Component({
  selector: 'app-hub-value',
  imports: [NzDescriptionsModule, NzEmptyModule, NzTableModule],
  styles: ['h4 { margin: var(--space-3) 0 var(--space-2); }'],
  template: `
    @if (list(); as items) {
      @if (items.length === 0) {
        <nz-empty nzNotFoundContent="Nessun dato" />
      } @else {
        <nz-table #t [nzData]="items" nzSize="small" [nzPageSize]="25" [nzScroll]="{ x: 'max-content' }">
          <thead>
            <tr>
              @for (c of columns(); track c) {
                <th>{{ c }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of t.data; track $index) {
              <tr>
                @for (c of columns(); track c) {
                  <td>{{ cell(row[c]) }}</td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
      }
    } @else if (object()) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
        @for (e of scalars(); track e[0]) {
          <nz-descriptions-item [nzTitle]="e[0]">{{ cell(e[1]) }}</nz-descriptions-item>
        }
      </nz-descriptions>
      @for (n of nested(); track n[0]) {
        <h4>{{ n[0] }}</h4>
        <app-hub-value [value]="n[1]" />
      }
    } @else if (unwrapped() !== null && unwrapped() !== undefined) {
      <p>{{ cell(unwrapped()) }}</p>
    }
  `,
})
export class HubValueComponent {
  readonly value = input<unknown>(null);

  protected readonly unwrapped = computed<unknown>(() => {
    const raw = this.value();
    if (isObject(raw) && 'data' in raw && Object.keys(raw).every((k) => ['success', 'message', 'data', 'meta', 'links'].includes(k))) {
      return raw['data'];
    }
    return raw;
  });
  protected readonly list = computed<Json[] | null>(() => {
    const v = this.unwrapped();
    return Array.isArray(v) ? v.map((item) => (isObject(item) ? item : { valore: item })) : null;
  });
  protected readonly object = computed<Json | null>(() => {
    const v = this.unwrapped();
    return isObject(v) ? v : null;
  });
  protected readonly columns = computed<string[]>(() => {
    const keys = new Set<string>();
    for (const item of (this.list() ?? []).slice(0, 20)) {
      for (const [k, v] of Object.entries(item)) {
        if (!HIDDEN.has(k) && !Array.isArray(v)) {
          keys.add(k);
        }
      }
    }
    return [...keys].slice(0, 12);
  });
  protected readonly scalars = computed(() =>
    Object.entries(this.object() ?? {}).filter(([k, v]) => !HIDDEN.has(k) && !Array.isArray(v) && !isLarge(v)),
  );
  protected readonly nested = computed(() =>
    Object.entries(this.object() ?? {}).filter(([k, v]) => !HIDDEN.has(k) && (Array.isArray(v) ? v.length > 0 : isLarge(v))),
  );

  protected cell(value: unknown): string {
    return hubCell(value);
  }
}

function isLarge(value: unknown): boolean {
  return isObject(value) && Object.keys(value).length > 3;
}
