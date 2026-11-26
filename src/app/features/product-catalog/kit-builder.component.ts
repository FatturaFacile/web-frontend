import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PcKitLinePayload, PcProduct, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { ProductEditorStore } from './product-editor.store';
import { emptyKitLine, kitProblems, PcOutcome } from './product-catalog.util';

interface KitLineView extends PcKitLinePayload {
  label: string;
}

/**
 * The bill of materials of a kit and the explosion preview: a phantom kit is sold as one line and exploded into its components
 * for picking and the transport document, a physical kit is stocked under its own SKU.
 */
@Component({
  selector: 'app-pc-kit-builder',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  styleUrl: './product-catalog.scss',
  template: `
    @if (!store.isKit()) {
      <nz-alert
        nzType="info"
        nzShowIcon
        [nzMessage]="'productCatalog.hint.notAKit' | translate"
      ></nz-alert>
    } @else {
      <p class="hint">{{ 'productCatalog.hint.' + store.product()?.kit_type | translate }}</p>

      @for (line of lines(); track $index; let i = $index) {
        <div class="kit-line">
          <nz-select
            class="kit-component"
            nzShowSearch
            nzServerSearch
            [nzPlaceHolder]="'productCatalog.field.component' | translate"
            [ngModel]="line.component_id || null"
            (nzOnSearch)="search($event)"
            (ngModelChange)="setComponent(i, $event)"
          >
            @for (option of options(); track option.id) {
              <nz-option
                [nzValue]="option.id"
                [nzLabel]="option.sku + ' - ' + option.name"
              ></nz-option>
            }
          </nz-select>
          <input
            nz-input
            class="kit-quantity"
            inputmode="decimal"
            [attr.aria-label]="'productCatalog.field.quantity' | translate"
            [ngModel]="line.quantity"
            (ngModelChange)="setQuantity(i, $event)"
          />
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox [ngModel]="line.is_optional" (ngModelChange)="setOptional(i, $event)">
            {{ 'productCatalog.field.optional' | translate }}
          </label>
          @if (canWrite()) {
            <button nz-button nzDanger type="button" (click)="remove(i)">
              {{ 'productCatalog.action.remove' | translate }}
            </button>
          }
        </div>
      }

      @for (problem of problems(); track problem) {
        <small class="error">{{ problem | translate }}</small>
      }

      @if (failure(); as problem) {
        <nz-alert
          nzType="error"
          nzShowIcon
          class="form-alert"
          [nzMessage]="problem.errorKey ?? '' | translate: problem.params"
        ></nz-alert>
      }

      @if (canWrite()) {
        <div class="actions">
          <button nz-button type="button" (click)="add()">
            {{ 'productCatalog.action.addLine' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="problems().length > 0 || lines().length === 0 || store.saving()"
            (click)="save()"
          >
            {{ 'productCatalog.action.saveKit' | translate }}
          </button>
        </div>
      }

      <h4>{{ 'productCatalog.section.explosion' | translate }}</h4>
      <div class="toolbar">
        <label class="field" for="pc-kit-qty">
          <span>{{ 'productCatalog.field.quantity' | translate }}</span>
          <input
            nz-input
            id="pc-kit-qty"
            inputmode="decimal"
            [ngModel]="explodeQty()"
            (ngModelChange)="explodeQty.set($event)"
          />
        </label>
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label
          nz-checkbox
          [ngModel]="includeOptional()"
          (ngModelChange)="includeOptional.set($event)"
        >
          {{ 'productCatalog.field.includeOptional' | translate }}
        </label>
        <button nz-button type="button" (click)="explode()">
          {{ 'productCatalog.action.explode' | translate }}
        </button>
      </div>

      @if (store.explosion(); as exploded) {
        <nz-table
          #explosionTable
          [nzData]="exploded"
          nzSize="small"
          [nzShowPagination]="false"
          [nzFrontPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'productCatalog.column.sku' | translate }}</th>
              <th>{{ 'productCatalog.column.name' | translate }}</th>
              <th>{{ 'productCatalog.column.quantity' | translate }}</th>
              <th>{{ 'productCatalog.column.via' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of explosionTable.data; track row.product_id) {
              <tr class="explosion-row">
                <td>{{ row.sku }}</td>
                <td>{{ row.name }}</td>
                <td>{{ row.quantity }}</td>
                <td>{{ row.via_kits.join(', ') }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }
  `,
})
export class KitBuilderComponent {
  protected readonly store = inject(ProductEditorStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly canWrite = input.required<boolean>();

  protected readonly lines = signal<KitLineView[]>([]);
  protected readonly options = signal<PcProduct[]>([]);
  protected readonly explodeQty = signal('1');
  protected readonly includeOptional = signal(false);
  protected readonly failure = signal<PcOutcome | null>(null);

  protected readonly problems = computed(() =>
    kitProblems(this.store.product()?.id ?? '', this.lines()),
  );

  constructor() {
    effect(() => {
      const kit = this.store.product();
      this.lines.set(
        (kit?.kit_components ?? []).map((line) => ({
          component_id: line.component_id,
          quantity: line.quantity,
          is_optional: line.is_optional,
          label: `${line.sku ?? ''} - ${line.name ?? ''}`,
        })),
      );
      this.options.set(
        (kit?.kit_components ?? []).map(
          (line) =>
            ({ id: line.component_id, sku: line.sku ?? '', name: line.name ?? '' }) as PcProduct,
        ),
      );
    });
  }

  protected async search(term: string): Promise<void> {
    const found = await this.store.searchProducts(term);
    const chosen = this.options().filter((option) =>
      this.lines().some((line) => line.component_id === option.id),
    );
    this.options.set([...chosen, ...found.filter((p) => !chosen.some((c) => c.id === p.id))]);
  }

  protected add(): void {
    this.lines.update((lines) => [...lines, { ...emptyKitLine(), label: '' }]);
  }

  protected remove(index: number): void {
    this.lines.update((lines) => lines.filter((_, position) => position !== index));
  }

  protected setComponent(index: number, id: string | null): void {
    this.patch(index, { component_id: id ?? '' });
  }

  protected setQuantity(index: number, quantity: string): void {
    this.patch(index, { quantity });
  }

  protected setOptional(index: number, optional: boolean): void {
    this.patch(index, { is_optional: optional });
  }

  private patch(index: number, change: Partial<KitLineView>): void {
    this.lines.update((lines) =>
      lines.map((line, position) => (position === index ? { ...line, ...change } : line)),
    );
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.saveKit(
      this.lines().map(({ component_id, quantity, is_optional }) => ({
        component_id,
        quantity,
        is_optional,
      })),
    );
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.saved'));
    }
  }

  protected async explode(): Promise<void> {
    const outcome = await this.store.explode(this.explodeQty(), this.includeOptional());
    this.failure.set(outcome.ok ? null : outcome);
  }
}
