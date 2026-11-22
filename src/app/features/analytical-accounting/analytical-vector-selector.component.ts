import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AllocationVector, AnalyticalCenter, COST_ELEMENT_TYPES } from '@core';
import { TranslatePipe } from '@shared';
import { fromCents, splitVectors, VectorMode } from './analytical-accounting.util';

/**
 * Reusable multi-dimensional allocation selector (cost center, profit center, project, product line, cost element) with
 * split lines by percentage or exact amount. It shows the exact cents of every vector and why a split is invalid, and is
 * meant for invoice lines, journal entries and analytical adjustments.
 */
@Component({
  selector: 'app-analytical-vector-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './analytical-accounting.scss',
  imports: [FormsModule, TranslatePipe, NzButtonModule, NzInputModule, NzRadioModule, NzSelectModule],
  template: `
    <div class="toolbar">
      <nz-radio-group [ngModel]="mode()" (ngModelChange)="setMode($event)">
        <label nz-radio-button nzValue="percentage">{{ 'ANALYTICAL.MODE_PERCENTAGE' | translate }}</label>
        <label nz-radio-button nzValue="amount">{{ 'ANALYTICAL.MODE_AMOUNT' | translate }}</label>
      </nz-radio-group>
      <button nz-button nzSize="small" (click)="add()">{{ 'ANALYTICAL.ADD_VECTOR' | translate }}</button>
    </div>

    @for (vector of vectors(); track $index; let i = $index) {
      <div class="vector-row">
        <nz-select
          nzAllowClear
          [nzPlaceHolder]="'ANALYTICAL.COST_CENTER' | translate"
          [ngModel]="vector.cost_center_id"
          (ngModelChange)="patch(i, { cost_center_id: $event ?? null })"
        >
          @for (center of costCenters(); track center.id) {
            <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
          }
        </nz-select>
        <nz-select
          nzAllowClear
          [nzPlaceHolder]="'ANALYTICAL.PROFIT_CENTER' | translate"
          [ngModel]="vector.profit_center_id"
          (ngModelChange)="patch(i, { profit_center_id: $event ?? null })"
        >
          @for (center of profitCenters(); track center.id) {
            <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
          }
        </nz-select>
        <input
          nz-input
          [placeholder]="'ANALYTICAL.PROJECT' | translate"
          [ngModel]="vector.project_id"
          (ngModelChange)="patch(i, { project_id: $event || null })"
        />
        <input
          nz-input
          [placeholder]="'ANALYTICAL.PRODUCT_LINE' | translate"
          [ngModel]="vector.product_line_id"
          (ngModelChange)="patch(i, { product_line_id: $event || null })"
        />
        <nz-select
          nzAllowClear
          [nzPlaceHolder]="'ANALYTICAL.COST_ELEMENT' | translate"
          [ngModel]="vector.cost_element_type"
          (ngModelChange)="patch(i, { cost_element_type: $event ?? null })"
        >
          @for (element of elements; track element) {
            <nz-option [nzValue]="element" [nzLabel]="'ANALYTICAL.ELEMENT_' + element | translate"></nz-option>
          }
        </nz-select>
        @if (mode() === 'percentage') {
          <input
            nz-input
            type="number"
            min="0"
            max="100"
            step="0.0001"
            [attr.aria-label]="'ANALYTICAL.PERCENTAGE' | translate"
            [ngModel]="vector.percentage"
            (ngModelChange)="patch(i, { percentage: $event === '' ? null : +$event })"
          />
        } @else {
          <input
            nz-input
            type="number"
            step="0.01"
            [attr.aria-label]="'ANALYTICAL.AMOUNT' | translate"
            [ngModel]="vector.amount"
            (ngModelChange)="patch(i, { amount: $event === '' ? null : '' + $event })"
          />
        }
        <button nz-button nzSize="small" nzDanger [attr.aria-label]="'ANALYTICAL.DELETE' | translate" (click)="remove(i)">×</button>
        @if (result().amounts[i] !== undefined) {
          <span class="muted num">{{ format(result().amounts[i]) }}</span>
        }
      </div>
    }

    @for (error of result().errors; track error) {
      <p class="error" role="alert">{{ error | translate }}</p>
    }
  `,
})
export class AnalyticalVectorSelectorComponent {
  readonly centers = input.required<AnalyticalCenter[]>();
  /** Line amount the vectors split. */
  readonly amount = input.required<string | number>();
  readonly vectors = model<AllocationVector[]>([]);

  protected readonly elements = COST_ELEMENT_TYPES;
  protected readonly costCenters = computed(() =>
    this.centers().filter((center) => center.center_type === 'COST_CENTER' && center.is_active),
  );
  protected readonly profitCenters = computed(() =>
    this.centers().filter((center) => center.center_type === 'PROFIT_CENTER' && center.is_active),
  );
  protected readonly result = computed(() => splitVectors(this.amount(), this.vectors()));
  protected readonly mode = signal<VectorMode>('percentage');

  protected format(cents: number): string {
    return fromCents(cents);
  }

  protected add(): void {
    const remaining = Math.max(0, 100 - this.vectors().reduce((sum, v) => sum + (v.percentage ?? 0), 0));
    this.vectors.update((list) => [
      ...list,
      this.mode() === 'percentage' ? { percentage: list.length === 0 ? 100 : remaining } : { amount: null },
    ]);
  }

  protected remove(index: number): void {
    this.vectors.update((list) => list.filter((_, i) => i !== index));
  }

  protected patch(index: number, change: Partial<AllocationVector>): void {
    this.vectors.update((list) => list.map((vector, i) => (i === index ? { ...vector, ...change } : vector)));
  }

  protected setMode(mode: VectorMode): void {
    this.mode.set(mode);
    this.vectors.update((list) =>
      list.map((vector) => ({
        ...vector,
        percentage: mode === 'percentage' ? (vector.percentage ?? null) : null,
        amount: mode === 'amount' ? (vector.amount ?? null) : null,
      })),
    );
  }
}
