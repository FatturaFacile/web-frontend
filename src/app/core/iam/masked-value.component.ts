import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { I18nService } from '../i18n';
import { PermissionStore } from './permission.store';

/**
 * Renders a value that field policies may protect. The API already removed the raw value of a masked or hidden field,
 * so this component only shows what it received: the masked text with a "Reserved" tag, nothing for a hidden field.
 * Pass `[value]` as received; the raw figure never exists in client memory.
 */
@Component({
  selector: 'app-masked-value',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzTagModule, NzTooltipModule],
  template: `
    @switch (visibility()) {
      @case ('hidden') {}
      @case ('masked') {
        <span class="masked-text">{{ value() }}</span>
        <nz-tag class="masked-tag" [nzTooltipTitle]="reservedHint()" nz-tooltip>{{ reservedLabel() }}</nz-tag>
      }
      @default {
        <span>{{ value() }}</span>
      }
    }
  `,
  styles: [':host { display: inline-flex; align-items: center; gap: 4px; } .masked-tag { margin: 0; }'],
})
export class MaskedValueComponent {
  private readonly store = inject(PermissionStore);
  private readonly i18n = inject(I18nService);

  readonly resource = input.required<string>();
  readonly field = input.required<string>();
  readonly value = input<string | number | null | undefined>(null);

  protected readonly visibility = computed(() => this.store.fieldVisibility(this.resource(), this.field()));
  protected readonly reservedLabel = computed(() => this.i18n.translate('IAM.RESERVED'));
  protected readonly reservedHint = computed(() => this.i18n.translate('IAM.RESERVED_HINT'));
}
