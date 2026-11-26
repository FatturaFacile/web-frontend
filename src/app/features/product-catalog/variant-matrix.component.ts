import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PcMatrixAxis, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { ProductEditorStore } from './product-editor.store';
import {
  attributeName,
  matrixCount,
  matrixTooLarge,
  PC_MAX_COMBINATIONS,
  PcOutcome,
  toggleAxisValue,
  valueLabel,
} from './product-catalog.util';

/** The multi-attribute variant matrix of a parent product: choose the values, preview the SKUs and prices, generate the variants. */
@Component({
  selector: 'app-pc-variant-matrix',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  styleUrl: './product-catalog.scss',
  template: `
    @if (!store.canHaveVariants()) {
      <nz-alert
        nzType="info"
        nzShowIcon
        [nzMessage]="'productCatalog.hint.noVariants' | translate"
      ></nz-alert>
    } @else {
      <p class="hint">{{ 'productCatalog.hint.matrix' | translate }}</p>

      @for (attribute of store.attributes(); track attribute.id) {
        <fieldset class="axis">
          <legend>{{ name(attribute) }}</legend>
          @for (value of attribute.values; track value.code) {
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label
              nz-checkbox
              [ngModel]="isChosen(attribute.id, value.id ?? '')"
              (ngModelChange)="toggle(attribute.id, value.id ?? '')"
            >
              {{ label(value) }}
              <small>{{ value.sku_token }}</small>
            </label>
          }
        </fieldset>
      } @empty {
        <nz-empty [nzNotFoundContent]="'productCatalog.empty.attributes' | translate"></nz-empty>
      }

      <div class="matrix-summary">
        <strong>{{ 'productCatalog.section.combinations' | translate }}: {{ count() }}</strong>
        @if (tooLarge()) {
          <span class="error">{{
            'productCatalog.error.too_many_combinations' | translate: { count: count(), max: max }
          }}</span>
        }
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label nz-checkbox [ngModel]="barcodes()" (ngModelChange)="barcodes.set($event)">
          {{ 'productCatalog.field.generateBarcodes' | translate }}
        </label>
      </div>

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
          <button nz-button type="button" [disabled]="!canRun()" (click)="preview()">
            {{ 'productCatalog.action.preview' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!canRun()"
            (click)="generate()"
          >
            {{ 'productCatalog.action.generate' | translate }}
          </button>
          <button nz-button type="button" [disabled]="store.saving()" (click)="reprice()">
            {{ 'productCatalog.action.reprice' | translate }}
          </button>
        </div>
      }

      @if (store.preview(); as preview) {
        <h4>
          {{ 'productCatalog.section.preview' | translate }} ({{ preview.new }}/{{ preview.total }})
        </h4>
        <nz-table
          #previewTable
          [nzData]="preview.combinations"
          nzSize="small"
          [nzShowPagination]="false"
          [nzFrontPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'productCatalog.column.sku' | translate }}</th>
              <th>{{ 'productCatalog.column.attributes' | translate }}</th>
              <th>{{ 'productCatalog.column.price' | translate }}</th>
              <th>{{ 'productCatalog.column.cost' | translate }}</th>
              <th>{{ 'productCatalog.column.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of previewTable.data; track row.key) {
              <tr class="preview-row">
                <td>{{ row.sku }}</td>
                <td>{{ labels(row.labels) }}</td>
                <td>{{ row.sale_price }}</td>
                <td>{{ row.cost_price }}</td>
                <td>
                  <nz-tag [nzColor]="row.exists ? 'default' : 'green'">
                    {{
                      (row.exists ? 'productCatalog.status.exists' : 'productCatalog.status.new')
                        | translate
                    }}
                  </nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }

      @if (store.generated(); as generated) {
        <nz-alert
          nzType="success"
          nzShowIcon
          class="form-alert"
          [nzMessage]="
            'productCatalog.message.generated'
              | translate: { created: generated.created.length, skipped: generated.skipped }
          "
        ></nz-alert>
      }

      <h4>
        {{ 'productCatalog.section.variants' | translate }} ({{
          store.product()?.variants?.length ?? 0
        }})
      </h4>
      <nz-table
        #variantTable
        [nzData]="store.product()?.variants ?? []"
        nzSize="small"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'productCatalog.column.sku' | translate }}</th>
            <th>{{ 'productCatalog.column.attributes' | translate }}</th>
            <th>{{ 'productCatalog.field.barcode' | translate }}</th>
            <th>{{ 'productCatalog.column.price' | translate }}</th>
            <th>{{ 'productCatalog.column.cost' | translate }}</th>
            <th>{{ 'productCatalog.column.status' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (variant of variantTable.data; track variant.id) {
            <tr class="variant-row">
              <td>{{ variant.sku }}</td>
              <td>{{ labels(variant.attributes) }}</td>
              <td>{{ variant.barcode }}</td>
              <td>{{ variant.sale_price }}</td>
              <td>{{ variant.cost_price }}</td>
              <td>
                <nz-tag [nzColor]="variant.price_overridden ? 'orange' : 'blue'">
                  {{
                    (variant.price_overridden
                      ? 'productCatalog.status.overridden'
                      : 'productCatalog.status.followsParent'
                    ) | translate
                  }}
                </nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class VariantMatrixComponent {
  protected readonly store = inject(ProductEditorStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly canWrite = input.required<boolean>();

  protected readonly max = PC_MAX_COMBINATIONS;
  protected readonly axes = signal<PcMatrixAxis[]>([]);
  protected readonly barcodes = signal(false);
  protected readonly failure = signal<PcOutcome | null>(null);

  protected readonly count = computed(() => matrixCount(this.axes()));
  protected readonly tooLarge = computed(() => matrixTooLarge(this.axes()));
  protected readonly canRun = computed(
    () => this.count() > 0 && !this.tooLarge() && !this.store.saving(),
  );

  private get locale(): string {
    return this.i18n.currentLanguage().slice(0, 2);
  }

  protected name(attribute: Parameters<typeof attributeName>[0]): string {
    return attributeName(attribute, this.locale);
  }

  protected label(value: Parameters<typeof valueLabel>[0]): string {
    return valueLabel(value, this.locale);
  }

  protected labels(map: Record<string, string>): string {
    return Object.entries(map)
      .map(([name, value]) => `${name}: ${value}`)
      .join(' / ');
  }

  protected isChosen(attributeId: string, valueId: string): boolean {
    return (
      this.axes()
        .find((axis) => axis.attribute_id === attributeId)
        ?.value_ids.includes(valueId) ?? false
    );
  }

  protected toggle(attributeId: string, valueId: string): void {
    this.axes.update((axes) => toggleAxisValue(axes, attributeId, valueId));
    this.store.clearPreview();
  }

  private request() {
    return { axes: this.axes(), generate_barcodes: this.barcodes() };
  }

  protected async preview(): Promise<void> {
    const outcome = await this.store.previewMatrix(this.request());
    this.failure.set(outcome.ok ? null : outcome);
  }

  protected async generate(): Promise<void> {
    const outcome = await this.store.generateMatrix(this.request());
    this.failure.set(outcome.ok ? null : outcome);
  }

  protected async reprice(): Promise<void> {
    const outcome = await this.store.repriceVariants();
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.repriced'));
    }
  }
}
