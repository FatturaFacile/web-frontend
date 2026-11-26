import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PcPackagingPayload, PcRoundingMode, PcUnit, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { ProductEditorStore } from './product-editor.store';
import {
  chainFactors,
  emptyLevel,
  packagingToPayload,
  trimDecimal,
  PcOutcome,
  unitLabel,
} from './product-catalog.util';

type Level = PcPackagingPayload['levels'][number];

/**
 * The multi-level unit hierarchy of a product (base stock unit, sales pack, purchase carton, pallet), the rounding policy and the
 * converter: the factor of every level is chained from its parents and a quantity converts through the base unit with one rounding.
 */
@Component({
  selector: 'app-pc-uom-packaging',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  styleUrl: './product-catalog.scss',
  template: `
    <p class="hint">{{ 'productCatalog.hint.units' | translate }}</p>

    <div class="toolbar">
      <label class="field" for="pc-rounding">
        <span>{{ 'productCatalog.field.rounding' | translate }}</span>
        <nz-select nzId="pc-rounding" [ngModel]="rounding()" (ngModelChange)="rounding.set($event)">
          @for (mode of store.lookups()?.rounding_modes ?? []; track mode) {
            <nz-option
              [nzValue]="mode"
              [nzLabel]="'productCatalog.rounding.' + mode | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="pc-precision">
        <span>{{ 'productCatalog.field.precision' | translate }}</span>
        <input
          nz-input
          id="pc-precision"
          type="number"
          min="0"
          max="6"
          [ngModel]="precision()"
          (ngModelChange)="precision.set(+$event)"
        />
      </label>
    </div>

    @for (level of levels(); track $index; let i = $index) {
      <div class="level-row">
        <input
          nz-input
          [attr.aria-label]="'productCatalog.field.code' | translate"
          [ngModel]="level.code"
          (ngModelChange)="patch(i, { code: ($event ?? '').toUpperCase() })"
        />
        <nz-select
          [nzPlaceHolder]="'productCatalog.field.unit' | translate"
          [ngModel]="level.uom_id || null"
          (ngModelChange)="patch(i, { uom_id: $event ?? '' })"
        >
          @for (unit of store.units(); track unit.id) {
            <nz-option [nzValue]="unit.id" [nzLabel]="unitName(unit)"></nz-option>
          }
        </nz-select>
        <input
          nz-input
          inputmode="decimal"
          [attr.aria-label]="'productCatalog.field.unitsPerParent' | translate"
          [ngModel]="level.units_per_parent"
          (ngModelChange)="patch(i, { units_per_parent: $event })"
        />
        <nz-select
          nzAllowClear
          [nzPlaceHolder]="'productCatalog.field.parent' | translate"
          [ngModel]="level.parent_code"
          (ngModelChange)="patch(i, { parent_code: $event ?? null })"
        >
          @for (other of parentChoices(i); track other) {
            <nz-option [nzValue]="other" [nzLabel]="other"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="level.role" (ngModelChange)="patch(i, { role: $event })">
          @for (role of store.lookups()?.packaging_roles ?? []; track role) {
            <nz-option
              [nzValue]="role"
              [nzLabel]="'productCatalog.role.' + role | translate"
            ></nz-option>
          }
        </nz-select>
        <input
          nz-input
          maxlength="14"
          [attr.aria-label]="'productCatalog.field.gtin' | translate"
          [ngModel]="level.gtin ?? ''"
          (ngModelChange)="patch(i, { gtin: $event || null })"
        />
        <span class="factor">{{ factorOf(level.code) }}</span>
        @if (canWrite()) {
          <button nz-button nzDanger type="button" (click)="remove(i)">
            {{ 'productCatalog.action.remove' | translate }}
          </button>
        }
      </div>
    }

    @for (problem of chain().problems; track problem) {
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
          [disabled]="!valid() || store.saving()"
          (click)="save()"
        >
          {{ 'productCatalog.action.saveUnits' | translate }}
        </button>
      </div>
    }

    <h4>{{ 'productCatalog.section.converter' | translate }}</h4>
    <div class="toolbar">
      <label class="field" for="pc-conv-qty">
        <span>{{ 'productCatalog.field.quantity' | translate }}</span>
        <input
          nz-input
          id="pc-conv-qty"
          inputmode="decimal"
          [ngModel]="quantity()"
          (ngModelChange)="quantity.set($event)"
        />
      </label>
      <label class="field" for="pc-conv-unit">
        <span>{{ 'productCatalog.field.unit' | translate }}</span>
        <nz-select nzId="pc-conv-unit" [ngModel]="unit()" (ngModelChange)="unit.set($event)">
          <nz-option nzValue="BASE" [nzLabel]="'productCatalog.unit.base' | translate"></nz-option>
          @for (code of savedCodes(); track code) {
            <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
          }
        </nz-select>
      </label>
      <button nz-button type="button" (click)="convert()">
        {{ 'productCatalog.action.convert' | translate }}
      </button>
    </div>

    @if (store.conversion(); as conversion) {
      <nz-table
        #conversionTable
        [nzData]="conversionRows()"
        nzSize="small"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'productCatalog.field.unit' | translate }}</th>
            <th>{{ 'productCatalog.column.quantity' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of conversionTable.data; track row.unit) {
            <tr class="conversion-row">
              <td>{{ row.unit }}</td>
              <td>{{ row.quantity }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      <p class="split">
        <strong>{{ 'productCatalog.section.split' | translate }}:</strong>
        @for (part of conversion.split.parts; track part.unit) {
          <span>{{ part.quantity }} × {{ part.unit }}</span>
        }
        <span>{{ conversion.split.remainder }} × {{ 'productCatalog.unit.base' | translate }}</span>
      </p>
    }
  `,
})
export class UomPackagingComponent {
  protected readonly store = inject(ProductEditorStore);
  private readonly i18n = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly canWrite = input.required<boolean>();

  protected readonly levels = signal<Level[]>([]);
  protected readonly rounding = signal<PcRoundingMode>('half_up');
  protected readonly precision = signal(4);
  protected readonly quantity = signal('1');
  protected readonly unit = signal('BASE');
  protected readonly failure = signal<PcOutcome | null>(null);

  protected readonly chain = computed(() => chainFactors(this.levels()));
  protected readonly savedCodes = computed(() =>
    (this.store.product()?.packagings ?? []).map((packaging) => packaging.code),
  );
  protected readonly valid = computed(
    () =>
      this.chain().problems.length === 0 &&
      this.levels().every((level) => level.code !== '' && level.uom_id !== ''),
  );
  protected readonly conversionRows = computed(() =>
    Object.entries(this.store.conversion()?.units ?? {}).map(([unit, quantity]) => ({
      unit,
      quantity,
    })),
  );

  protected unitName(unit: PcUnit): string {
    return unitLabel(unit, (key) => this.i18n.instant(key));
  }

  constructor() {
    effect(() => {
      const product = this.store.product();
      this.levels.set(packagingToPayload(product?.packagings ?? []));
      this.rounding.set(product?.uom_rounding ?? 'half_up');
      this.precision.set(product?.uom_precision ?? 4);
    });
  }

  protected factorOf(code: string): string {
    const factor = this.chain().factors[code.toUpperCase()];
    return factor === undefined ? '' : trimDecimal(factor);
  }

  protected parentChoices(index: number): string[] {
    return this.levels()
      .map((level) => level.code)
      .filter((code, position) => code !== '' && position !== index);
  }

  protected add(): void {
    this.levels.update((levels) => [...levels, emptyLevel()]);
  }

  protected remove(index: number): void {
    this.levels.update((levels) => levels.filter((_, position) => position !== index));
  }

  protected patch(index: number, change: Partial<Level>): void {
    this.levels.update((levels) =>
      levels.map((level, position) => (position === index ? { ...level, ...change } : level)),
    );
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.savePackagings({
      uom_rounding: this.rounding(),
      uom_precision: this.precision(),
      levels: this.levels(),
    });
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.saved'));
    }
  }

  protected async convert(): Promise<void> {
    const outcome = await this.store.convert(this.quantity(), this.unit());
    this.failure.set(outcome.ok ? null : outcome);
  }
}
