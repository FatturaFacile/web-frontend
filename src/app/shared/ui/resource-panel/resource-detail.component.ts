import { Component, computed, inject, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ResourceLabelsService } from './resource-labels.service';

const HIDDEN_KEYS = new Set(['tenant_id', 'deleted_at', 'links', 'updated_at']);

type DetailKind = 'empty' | 'scalar' | 'boolean' | 'scalarList' | 'records' | 'object';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursive read-only renderer of an API payload (object, list of records or scalar). */
@Component({
  selector: 'app-resource-detail',
  imports: [NzTagModule, TranslatePipe],
  templateUrl: './resource-detail.component.html',
})
export class ResourceDetailComponent {
  protected readonly labels = inject(ResourceLabelsService);

  readonly value = input<unknown>(null);

  protected readonly kind = computed<DetailKind>(() => {
    const value = this.value();
    if (value === null || value === undefined || value === '') {
      return 'empty';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'empty';
      }
      return value.every(isRecord) ? 'records' : 'scalarList';
    }
    return isRecord(value) ? 'object' : 'scalar';
  });

  protected readonly entries = computed(() => {
    const value = this.value();
    return isRecord(value)
      ? Object.entries(value).filter(([key, item]) => !HIDDEN_KEYS.has(key) && item !== null && item !== '')
      : [];
  });

  protected readonly records = computed(() => {
    const value = this.value();
    return Array.isArray(value) ? value.filter(isRecord) : [];
  });

  protected readonly columns = computed(() => {
    const keys = new Set<string>();
    for (const record of this.records()) {
      for (const key of Object.keys(record)) {
        if (!HIDDEN_KEYS.has(key)) {
          keys.add(key);
        }
      }
    }
    return [...keys];
  });

  protected readonly scalarText = computed(() => {
    const value = this.value();
    return Array.isArray(value) ? value.map(String).join(', ') : String(value ?? '');
  });
}
