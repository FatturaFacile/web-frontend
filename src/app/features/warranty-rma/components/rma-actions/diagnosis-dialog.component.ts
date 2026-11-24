import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  DiagnosisLinePayload,
  I18nService,
  RmaLineType,
  RmaWithEstimateLink,
  serverErrorMessage,
} from '@core';
import { CurrencyFormatPipe, TranslatePipe } from '@shared';
import { ActionResult } from '../../state/action-result';
import { esmErrorBody } from '../../utils/rma-status';
import { RmaDetailStore } from '../../state/rma-detail.store';

type LineRow = FormGroup<{
  line_type: FormControl<RmaLineType>;
  description: FormControl<string>;
  qty: FormControl<number>;
  unit_cost: FormControl<number>;
  unit_price: FormControl<number>;
  product_id: FormControl<string>;
  defective_part_serial: FormControl<string>;
  supplier_id: FormControl<string>;
  replacement_part_serial: FormControl<string>;
}>;

const nullable = (v: string): string | null => v.trim() || null;

/**
 * Bench diagnosis and repair quote. The backend decides coverage: covered/goodwill lines are charged
 * to the warranty provision; billable estimates above the threshold return a once-only estimate link.
 */
@Component({
  selector: 'app-rma-diagnosis-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzCheckboxModule,
    NzButtonModule,
    TranslatePipe,
    CurrencyFormatPipe,
  ],
  templateUrl: './diagnosis-dialog.component.html',
  styles: `
    .diag-line {
      border: 1px solid var(--ff-color-border);
      border-radius: 8px;
      padding: 8px 16px 16px;
      margin-bottom: 12px;
    }
    .diag-line legend {
      font-weight: 600;
      font-size: 14px;
      width: auto;
      padding: 0 4px;
      margin: 0;
      border: 0;
    }
  `,
})
export class DiagnosisDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(RmaDetailStore);

  readonly open = model(false);
  readonly currency = input('EUR');
  readonly finished = output<ActionResult<RmaWithEstimateLink>>();
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    lab_bench_diagnostic_notes: this.fb.control('', [
      Validators.required,
      Validators.maxLength(5000),
    ]),
    repair_feasible: this.fb.control(true),
    parts_available: this.fb.control(true),
    goodwill: this.fb.control(false),
    lines: this.fb.array<LineRow>([]),
  });

  private readonly linesValue = toSignal(this.form.controls.lines.valueChanges, {
    initialValue: [],
  });

  /** Customer price preview before the backend applies warranty coverage. */
  readonly previewTotal = computed(() =>
    this.linesValue().reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_price) || 0),
      0,
    ),
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.form.controls.lines.clear();
        this.formErrors.set([]);
      }
    });
  }

  addLine(type: RmaLineType): void {
    this.form.controls.lines.push(
      this.fb.group({
        line_type: this.fb.control<RmaLineType>(type),
        description: this.fb.control('', Validators.required),
        qty: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
        unit_cost: this.fb.control(0, [Validators.required, Validators.min(0)]),
        unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
        product_id: this.fb.control(''),
        defective_part_serial: this.fb.control(''),
        supplier_id: this.fb.control(''),
        replacement_part_serial: this.fb.control(''),
      }),
    );
  }

  removeLine(index: number): void {
    this.form.controls.lines.removeAt(index);
  }

  errorTip(path: string): string {
    return (
      serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')
    );
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.controls.lab_bench_diagnostic_notes.markAsDirty();
      this.form.controls.lines.controls.forEach((g) =>
        Object.values(g.controls).forEach((c) => {
          c.markAsDirty();
          c.updateValueAndValidity();
        }),
      );
      return;
    }
    const v = this.form.getRawValue();
    const lines: DiagnosisLinePayload[] = v.lines.map((l) => ({
      line_type: l.line_type,
      description: l.description.trim(),
      qty: l.qty,
      unit_cost: l.unit_cost,
      unit_price: l.unit_price,
      product_id: nullable(l.product_id),
      defective_part_serial: nullable(l.defective_part_serial),
      supplier_id: nullable(l.supplier_id),
      replacement_part_serial: nullable(l.replacement_part_serial),
    }));
    const res = await this.store.diagnose({
      lab_bench_diagnostic_notes: v.lab_bench_diagnostic_notes.trim(),
      repair_feasible: v.repair_feasible,
      parts_available: v.parts_available,
      goodwill: v.goodwill,
      lines,
    });
    if (!res.ok && res.status === 422) {
      // Errors on the `lines` array itself (e.g. "at least one line") have no control to show them.
      const lineErrors = esmErrorBody(res.error)?.errors?.['lines'] ?? [];
      this.formErrors.set([...applyServerErrors(this.form, res.error), ...lineErrors]);
      return;
    }
    this.open.set(false);
    this.finished.emit(res);
  }
}
