import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n/i18n.service';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  AnalyticsApiService,
  StudioCalculatedField,
  StudioDefinition,
  StudioValueFormat,
} from '@core';
import { TranslatePipe } from '@shared';
import { analyticsErrorText } from '../analytics-designer.util';
import { formulaProblem, nextCalculatedKey } from './studio-state';
import { VALUE_FORMAT_KEYS } from './studio-keys';

export type FormulaStatus = 'idle' | 'checking' | 'ok' | 'error';

/**
 * Creates a calculated measure: a label, a formula over the measures of the report (`+ - * /`, parentheses, ABS, ROUND,
 * COALESCE, NULLIF) and a number format. The formula is checked while typing, first by a local whitelist check and then by
 * the backend parser on a real (aggregate-only) run, so what the form accepts is what the report will run.
 */
@Component({
  selector: 'app-calculated-measure-modal',
  imports: [
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'ANALYTICS_STUDIO.CALC_TITLE' | translate"
      [nzFooter]="footer"
      (nzOnCancel)="close()"
      nzWidth="560px"
    >
      <ng-container *nzModalContent>
        <div class="field">
          <label for="calc-label">{{ 'ANALYTICS_STUDIO.CALC_LABEL' | translate }}</label>
          <input
            id="calc-label"
            nz-input
            [ngModel]="label()"
            (ngModelChange)="label.set($event)"
            maxlength="120"
          />
        </div>
        <div class="field">
          <label for="calc-formula">{{ 'ANALYTICS_STUDIO.CALC_FORMULA' | translate }}</label>
          <textarea
            id="calc-formula"
            nz-input
            rows="3"
            [ngModel]="formula()"
            (ngModelChange)="onFormula($event)"
            spellcheck="false"
            placeholder="(a - b) / NULLIF(a, 0)"
          ></textarea>
          <small class="hint">{{
            'ANALYTICS_STUDIO.CALC_HELP' | translate: { functions: functions().join(', ') }
          }}</small>
          <div class="status" role="status" aria-live="polite" data-testid="formula-status">
            @switch (status()) {
              @case ('checking') {
                <span>{{ 'ANALYTICS_STUDIO.FORMULA_CHECKING' | translate }}</span>
              }
              @case ('ok') {
                <span class="ok">{{ 'ANALYTICS_STUDIO.FORMULA_VALID' | translate }}</span>
              }
              @case ('error') {
                <span class="error">{{ problemText() }}</span>
              }
            }
          </div>
        </div>
        <div class="field">
          <span id="calc-refs-label">{{ 'ANALYTICS_STUDIO.CALC_AVAILABLE' | translate }}</span>
          <div class="refs" aria-labelledby="calc-refs-label">
            @for (reference of references(); track reference) {
              <button type="button" class="ref" (click)="insert(reference)">{{ reference }}</button>
            }
          </div>
        </div>
        <div class="field">
          <label for="calc-format">{{ 'ANALYTICS_STUDIO.CALC_FORMAT' | translate }}</label>
          <nz-select id="calc-format" [ngModel]="format()" (ngModelChange)="format.set($event)">
            @for (item of formats(); track item) {
              <nz-option [nzValue]="item" [nzLabel]="formatKeys[item] | translate"></nz-option>
            }
          </nz-select>
        </div>
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="close()">
          {{ 'ANALYTICS_STUDIO.CANCEL' | translate }}
        </button>
        <button nz-button nzType="primary" type="button" [disabled]="!canSave()" (click)="save()">
          {{ 'ANALYTICS_STUDIO.CALC_ADD' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: [
    '.field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}.hint{color:var(--ant-text-color-secondary,#6b7280)}.status{min-height:20px}.status .ok{color:#237804}.status .error{color:#a8071a}.refs{display:flex;flex-wrap:wrap;gap:6px}.ref{border:1px solid var(--ant-border-color-base,#d9d9d9);background:#e6f4ff;border-radius:4px;padding:2px 8px;cursor:pointer;min-height:24px}',
  ],
})
export class CalculatedMeasureModalComponent {
  private readonly api = inject(AnalyticsApiService);
  private readonly i18n = inject(I18nService);

  readonly visible = model(false);
  /** Measures (and earlier calculated measures) a formula may read. */
  readonly references = input<string[]>([]);
  readonly functions = input<string[]>(['ABS', 'ROUND', 'COALESCE', 'NULLIF']);
  readonly formats = input<StudioValueFormat[]>(['currency', 'number', 'percentage', 'integer']);
  readonly existingKeys = input<string[]>([]);
  /** The report as it is now: the formula is validated by running it on this definition. */
  readonly definition = input.required<StudioDefinition>();
  readonly saved = output<StudioCalculatedField>();

  protected readonly formatKeys = VALUE_FORMAT_KEYS;
  readonly label = signal('');
  readonly formula = signal('');
  readonly format = signal<StudioValueFormat>('number');
  readonly status = signal<FormulaStatus>('idle');
  readonly problem = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ticket = 0;

  protected readonly problemText = computed(() => {
    const problem = this.problem();

    return problem !== null && problem.startsWith('ANALYTICS_STUDIO.')
      ? this.i18n.translate(problem)
      : (problem ?? '');
  });
  readonly canSave = computed(() => this.status() === 'ok' && this.label().trim() !== '');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  onFormula(value: string): void {
    this.formula.set(value);
    this.status.set(value.trim() === '' ? 'idle' : 'checking');
    this.clearTimer();
    this.timer = setTimeout(() => this.check(), 500);
  }

  insert(reference: string): void {
    this.onFormula(
      `${this.formula()}${this.formula() === '' || this.formula().endsWith(' ') ? '' : ' '}${reference}`,
    );
  }

  /** Checks the formula: locally first, then with the backend parser. */
  check(): void {
    this.clearTimer();
    const formula = this.formula().trim();

    if (formula === '') {
      this.status.set('idle');

      return;
    }

    const local = formulaProblem(formula, this.references(), this.functions());
    if (local !== null) {
      this.status.set('error');
      this.problem.set(local);

      return;
    }

    const ticket = ++this.ticket;
    const base = this.definition();
    const candidate: StudioCalculatedField = {
      key: this.key(),
      label: this.label().trim() || this.key(),
      formula,
      format: this.format(),
    };
    this.status.set('checking');
    this.api
      .runPivot({
        ...base,
        pivot: { rows: [], columns: [], subtotals: false, grand_totals: false },
        spec: { ...base.spec, dimensions: [] },
        calculated_fields: [...base.calculated_fields, candidate],
        conditional_formatting: [],
        chart_config: { ...base.chart_config, enabled: false, series: [] },
      })
      .subscribe({
        next: () => {
          if (ticket === this.ticket) {
            this.status.set('ok');
            this.problem.set(null);
          }
        },
        error: (error: unknown) => {
          if (ticket === this.ticket) {
            this.status.set('error');
            this.problem.set(analyticsErrorText(error) ?? 'ANALYTICS_STUDIO.FORMULA_REJECTED');
          }
        },
      });
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }
    this.saved.emit({
      key: this.key(),
      label: this.label().trim(),
      formula: this.formula().trim(),
      format: this.format(),
    });
    this.close();
  }

  close(): void {
    this.visible.set(false);
    this.label.set('');
    this.formula.set('');
    this.format.set('number');
    this.status.set('idle');
    this.problem.set(null);
    this.ticket++;
    this.clearTimer();
  }

  private key(): string {
    return nextCalculatedKey(this.existingKeys());
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
