import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  CurrencyApiService,
  FX_REVALUATION_PERIOD_TYPES,
  FxRevaluationPeriodType,
  FxRevaluationRun,
  I18nService,
  PermissionsService,
} from '@core';
import {
  currencyProblemText,
  isCurrencyFailure,
  PageHeaderComponent,
  TranslatePipe,
} from '@shared';
import {
  CURRENCY_FX_MODULE,
  newIdempotencyKey,
  previousMonthEnd,
  revaluationResultColor,
  revaluationStatusColor,
  signClass,
} from './currency-fx.util';

/**
 * Period-end FX revaluation (route `finance/currencies/revaluation`). Step 1 chooses the period and simulates, step 2
 * previews the lines and the totals, step 3 posts the journal entry with an `Idempotency-Key` that stays the same for
 * every retry of this wizard run (a 409 means it was already posted). A posted run can be reversed. The past runs are
 * listed below.
 */
@Component({
  selector: 'app-fx-revaluation-wizard',
  imports: [
    NgTemplateOutlet,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  styleUrl: './currency-fx.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FX_REVALUATION' | translate"></app-page-header>

    <a nz-button nzType="link" routerLink="/finance/currencies">{{
      'FINANCE.FX_REVALUATION.ACTION.BACK_TO_RATES' | translate
    }}</a>

    <nz-steps class="steps" [nzCurrent]="step()" nzSize="small">
      <nz-step [nzTitle]="'FINANCE.FX_REVALUATION.STEP.PERIOD' | translate"></nz-step>
      <nz-step [nzTitle]="'FINANCE.FX_REVALUATION.STEP.PREVIEW' | translate"></nz-step>
      <nz-step [nzTitle]="'FINANCE.FX_REVALUATION.STEP.POST' | translate"></nz-step>
    </nz-steps>

    @if (error(); as key) {
      <nz-alert
        class="form-alert wizard-error"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="key | translate"
        [nzDescription]="detail()"
        (nzOnClose)="error.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="busy()">
      @switch (step()) {
        @case (0) {
          <form
            nz-form
            nzLayout="vertical"
            [formGroup]="form"
            (ngSubmit)="simulate()"
            class="period-form"
          >
            <div class="grid">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="fx-period-end">{{
                  'FINANCE.FX_REVALUATION.FIELD.PERIOD_END' | translate
                }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('period_end')">
                  <input nz-input id="fx-period-end" type="date" formControlName="period_end" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="fx-period-type">{{
                  'FINANCE.FX_REVALUATION.FIELD.PERIOD_TYPE' | translate
                }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('period_type')">
                  <nz-select nzId="fx-period-type" formControlName="period_type">
                    @for (type of periodTypes; track type) {
                      <nz-option
                        [nzValue]="type"
                        [nzLabel]="'FINANCE.FX_REVALUATION.PERIOD_TYPE.' + type | translate"
                      ></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="fx-currencies">{{
                  'FINANCE.FX_REVALUATION.FIELD.CURRENCIES' | translate
                }}</nz-form-label>
                <nz-form-control
                  [nzErrorTip]="errorTip('currencies')"
                  [nzExtra]="'FINANCE.FX_REVALUATION.HINT.CURRENCIES' | translate"
                >
                  <nz-select
                    nzId="fx-currencies"
                    nzMode="tags"
                    formControlName="currencies"
                    [nzTokenSeparators]="[',', ' ']"
                  ></nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
            @if (canWrite) {
              <div class="form-footer">
                <button nz-button nzType="primary" type="submit" class="simulate">
                  {{ 'FINANCE.FX_REVALUATION.ACTION.SIMULATE' | translate }}
                </button>
              </div>
            }
          </form>
        }
        @case (1) {
          @if (run(); as current) {
            <ng-container
              [ngTemplateOutlet]="totalsTpl"
              [ngTemplateOutletContext]="{ run: current }"
            ></ng-container>
            <nz-table
              #lines
              nzSize="small"
              [nzData]="current.lines ?? []"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.LINE_TYPE' | translate }}</th>
                  <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.CURRENCY' | translate }}</th>
                  <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.REFERENCE' | translate }}</th>
                  <th class="num">
                    {{ 'FINANCE.FX_REVALUATION.COLUMN.CURRENCY_BALANCE' | translate }}
                  </th>
                  <th class="num">{{ 'FINANCE.FX_REVALUATION.COLUMN.BOOK_VALUE' | translate }}</th>
                  <th class="num">
                    {{ 'FINANCE.FX_REVALUATION.COLUMN.CLOSING_RATE' | translate }}
                  </th>
                  <th class="num">
                    {{ 'FINANCE.FX_REVALUATION.COLUMN.REVALUED_VALUE' | translate }}
                  </th>
                  <th class="num">{{ 'FINANCE.FX_REVALUATION.COLUMN.DIFFERENCE' | translate }}</th>
                  <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.RESULT' | translate }}</th>
                  <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.TREATMENT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines.data; track line.id) {
                  <tr>
                    <td>{{ 'FINANCE.FX_REVALUATION.LINE_TYPE.' + line.line_type | translate }}</td>
                    <td>{{ line.currency }}</td>
                    <td>{{ line.reference }}</td>
                    <td class="num">{{ line.currency_balance }}</td>
                    <td class="num">{{ line.book_value }}</td>
                    <td class="num">{{ line.closing_rate }}</td>
                    <td class="num">{{ line.revalued_value }}</td>
                    <td class="num" [class]="gainClass(line.difference)">{{ line.difference }}</td>
                    <td>
                      <nz-tag [nzColor]="resultColor(line.result)">{{
                        'FINANCE.FX_REVALUATION.RESULT.' + line.result | translate
                      }}</nz-tag>
                    </td>
                    <td>{{ 'FINANCE.CURRENCIES.TREATMENT.' + line.treatment | translate }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="10">
                      <nz-empty
                        [nzNotFoundContent]="'FINANCE.FX_REVALUATION.EMPTY.LINES' | translate"
                      ></nz-empty>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <div class="form-footer">
              <button nz-button type="button" class="back" (click)="restart()">
                {{ 'FINANCE.FX_REVALUATION.ACTION.BACK' | translate }}
              </button>
              <button
                nz-button
                nzType="primary"
                type="button"
                class="to-post"
                (click)="step.set(2)"
              >
                {{ 'FINANCE.FX_REVALUATION.ACTION.CONTINUE' | translate }}
              </button>
            </div>
          }
        }
        @case (2) {
          @if (run(); as current) {
            <ng-container
              [ngTemplateOutlet]="totalsTpl"
              [ngTemplateOutletContext]="{ run: current }"
            ></ng-container>
            @if (alreadyPosted()) {
              <nz-alert
                class="form-alert already-posted"
                nzType="warning"
                nzShowIcon
                [nzMessage]="'FINANCE.FX_REVALUATION.MESSAGE.ALREADY_POSTED' | translate"
              ></nz-alert>
            }
            @switch (current.status) {
              @case ('draft') {
                <p>{{ 'FINANCE.FX_REVALUATION.HINT.POST' | translate }}</p>
                <div class="form-footer">
                  <button nz-button type="button" class="back" (click)="step.set(1)">
                    {{ 'FINANCE.FX_REVALUATION.ACTION.BACK' | translate }}
                  </button>
                  @if (canWrite) {
                    <button
                      nz-button
                      nzType="primary"
                      type="button"
                      class="post"
                      [nzLoading]="busy()"
                      (click)="post()"
                    >
                      {{ 'FINANCE.FX_REVALUATION.ACTION.POST' | translate }}
                    </button>
                  }
                </div>
              }
              @case ('posted') {
                <nz-alert
                  class="form-alert posted"
                  nzType="success"
                  nzShowIcon
                  [nzMessage]="'FINANCE.FX_REVALUATION.MESSAGE.POSTED' | translate"
                  [nzDescription]="current.journal_entry_id ?? ''"
                ></nz-alert>
                <div class="form-footer">
                  <button nz-button type="button" class="restart" (click)="restart()">
                    {{ 'FINANCE.FX_REVALUATION.ACTION.NEW_REVALUATION' | translate }}
                  </button>
                  @if (canWrite) {
                    <button
                      nz-button
                      nzDanger
                      type="button"
                      class="reverse"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'FINANCE.FX_REVALUATION.CONFIRM.REVERSE' | translate"
                      [nzOkText]="'FINANCE.FX_REVALUATION.ACTION.REVERSE' | translate"
                      [nzCancelText]="'FINANCE.CURRENCIES.ACTION.CANCEL' | translate"
                      (nzOnConfirm)="reverse()"
                    >
                      {{ 'FINANCE.FX_REVALUATION.ACTION.REVERSE' | translate }}
                    </button>
                  }
                </div>
              }
              @case ('reversed') {
                <nz-alert
                  class="form-alert reversed"
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="'FINANCE.FX_REVALUATION.MESSAGE.REVERSED' | translate"
                  [nzDescription]="current.reversal_journal_entry_id ?? ''"
                ></nz-alert>
                <div class="form-footer">
                  <button nz-button type="button" class="restart" (click)="restart()">
                    {{ 'FINANCE.FX_REVALUATION.ACTION.NEW_REVALUATION' | translate }}
                  </button>
                </div>
              }
            }
          }
        }
      }
    </nz-spin>

    <ng-template #totalsTpl let-run="run">
      <div class="totals">
        <div>
          <span class="muted">{{ 'FINANCE.FX_REVALUATION.TOTAL.PERIOD' | translate }}</span>
          <strong>{{ run.period_end }}</strong>
        </div>
        <div>
          <span class="muted">{{ 'FINANCE.FX_REVALUATION.TOTAL.GAIN' | translate }}</span>
          <strong class="fx-gain total-gain"
            >{{ run.total_gain }} {{ run.functional_currency }}</strong
          >
        </div>
        <div>
          <span class="muted">{{ 'FINANCE.FX_REVALUATION.TOTAL.LOSS' | translate }}</span>
          <strong class="fx-loss total-loss"
            >{{ run.total_loss }} {{ run.functional_currency }}</strong
          >
        </div>
        <div>
          <span class="muted">{{ 'FINANCE.FX_REVALUATION.TOTAL.NET' | translate }}</span>
          <strong class="total-net" [class]="gainClass(run.net_result)"
            >{{ run.net_result }} {{ run.functional_currency }}</strong
          >
        </div>
      </div>
    </ng-template>

    <h3>{{ 'FINANCE.FX_REVALUATION.SECTION.HISTORY' | translate }}</h3>
    <nz-table
      #history
      nzSize="small"
      [nzData]="past()"
      [nzShowPagination]="false"
      [nzFrontPagination]="false"
    >
      <thead>
        <tr>
          <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.PERIOD_END' | translate }}</th>
          <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.PERIOD_TYPE' | translate }}</th>
          <th>{{ 'FINANCE.FX_REVALUATION.COLUMN.STATUS' | translate }}</th>
          <th class="num">{{ 'FINANCE.FX_REVALUATION.TOTAL.GAIN' | translate }}</th>
          <th class="num">{{ 'FINANCE.FX_REVALUATION.TOTAL.LOSS' | translate }}</th>
          <th class="num">{{ 'FINANCE.FX_REVALUATION.TOTAL.NET' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (item of history.data; track item.id) {
          <tr>
            <td>{{ item.period_end }}</td>
            <td>{{ 'FINANCE.FX_REVALUATION.PERIOD_TYPE.' + item.period_type | translate }}</td>
            <td>
              <nz-tag [nzColor]="statusColor(item)">{{
                'FINANCE.FX_REVALUATION.STATUS.' + item.status | translate
              }}</nz-tag>
            </td>
            <td class="num">{{ item.total_gain }}</td>
            <td class="num">{{ item.total_loss }}</td>
            <td class="num" [class]="gainClass(item.net_result)">{{ item.net_result }}</td>
            <td class="row-actions">
              <button nz-button nzSize="small" type="button" class="open-run" (click)="open(item)">
                {{ 'FINANCE.FX_REVALUATION.ACTION.OPEN' | translate }}
              </button>
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="7">
              <nz-empty
                [nzNotFoundContent]="'FINANCE.FX_REVALUATION.EMPTY.HISTORY' | translate"
              ></nz-empty>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class FxRevaluationWizardComponent implements OnInit {
  private readonly api = inject(CurrencyApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = this.permissions.canWrite(CURRENCY_FX_MODULE);
  protected readonly periodTypes: readonly FxRevaluationPeriodType[] = FX_REVALUATION_PERIOD_TYPES;

  readonly step = signal<0 | 1 | 2>(0);
  readonly run = signal<FxRevaluationRun | null>(null);
  readonly busy = signal(false);
  readonly alreadyPosted = signal(false);
  readonly error = signal<string | null>(null);
  readonly detail = signal<string | null>(null);
  protected readonly past = signal<FxRevaluationRun[]>([]);

  /** One key per run of the wizard: every retry of the posting sends the same one, so the API replays instead of posting twice. */
  private postKey: string | null = null;

  readonly form = this.fb.group({
    period_end: this.fb.control(previousMonthEnd(), Validators.required),
    period_type: this.fb.control<FxRevaluationPeriodType>('monthly', Validators.required),
    currencies: this.fb.control<string[]>([]),
  });

  protected readonly gainClass = signClass;
  protected readonly resultColor = revaluationResultColor;
  protected readonly statusColor = (run: FxRevaluationRun): string =>
    revaluationStatusColor(run.status);

  ngOnInit(): void {
    void this.loadHistory();
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('required')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.REQUIRED');
    }
    const server = control?.errors?.['serverError'];
    return typeof server === 'string' ? server : '';
  }

  async loadHistory(): Promise<void> {
    try {
      this.past.set((await firstValueFrom(this.api.listRevaluations({ per_page: 20 }))).data);
    } catch {
      this.past.set([]);
    }
  }

  /** Step 1: runs the simulation for the period; nothing is posted. */
  async simulate(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const currencies = value.currencies
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{3}$/u.test(code));
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.api.simulateRevaluation({
          period_end: value.period_end,
          period_type: value.period_type,
          ...(currencies.length > 0 ? { currencies } : {}),
        }),
      );
      this.begin(response.data);
      this.step.set(1);
      void this.loadHistory();
    } catch (error) {
      if (!applyServerErrors(this.form, error).length && this.hasFieldErrors(error)) {
        return;
      }
      this.fail('FINANCE.FX_REVALUATION.ERROR.SIMULATE_FAILED', error);
    } finally {
      this.busy.set(false);
    }
  }

  /** Step 3: posts the journal entry. Calling it again (a retry) reuses the idempotency key of this wizard run. */
  async post(): Promise<void> {
    const current = this.run();
    if (current === null) {
      return;
    }
    this.postKey ??= newIdempotencyKey();
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.postRevaluation(current.id, this.postKey));
      this.alreadyPosted.set(false);
      this.run.set({ ...response.data, lines: response.data.lines ?? current.lines });
      this.message.success(this.i18n.translate('FINANCE.FX_REVALUATION.MESSAGE.POSTED'));
      void this.loadHistory();
    } catch (error) {
      if (isCurrencyFailure(error, 409)) {
        // Somebody (or an earlier attempt with another key) already posted this revaluation: show its real state.
        this.alreadyPosted.set(true);
        await this.refreshRun(current.id);
      } else {
        this.fail('FINANCE.FX_REVALUATION.ERROR.POST_FAILED', error);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async reverse(): Promise<void> {
    const current = this.run();
    if (current === null) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.reverseRevaluation(current.id));
      this.run.set({ ...response.data, lines: response.data.lines ?? current.lines });
      this.message.success(this.i18n.translate('FINANCE.FX_REVALUATION.MESSAGE.REVERSED'));
      void this.loadHistory();
    } catch (error) {
      if (isCurrencyFailure(error, 409)) {
        this.message.warning(this.i18n.translate('FINANCE.FX_REVALUATION.MESSAGE.NOT_POSTED'));
        await this.refreshRun(current.id);
      } else {
        this.fail('FINANCE.FX_REVALUATION.ERROR.REVERSE_FAILED', error);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Opens a past revaluation: a draft continues at the preview, a posted or reversed one shows its state. */
  async open(item: FxRevaluationRun): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.getRevaluation(item.id));
      this.begin(response.data);
      this.step.set(response.data.status === 'draft' ? 1 : 2);
    } catch (error) {
      this.fail('FINANCE.FX_REVALUATION.ERROR.LOAD_FAILED', error);
    } finally {
      this.busy.set(false);
    }
  }

  restart(): void {
    this.run.set(null);
    this.postKey = null;
    this.alreadyPosted.set(false);
    this.error.set(null);
    this.step.set(0);
  }

  /** A new run of the wizard starts with a new idempotency key. */
  private begin(run: FxRevaluationRun): void {
    this.run.set(run);
    this.postKey = newIdempotencyKey();
    this.alreadyPosted.set(false);
  }

  private async refreshRun(id: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getRevaluation(id));
      this.run.set(response.data);
    } catch {
      // The state shown stays as it was; the history reload below still tells the truth.
    }
    void this.loadHistory();
  }

  private hasFieldErrors(error: unknown): boolean {
    return (
      Object.keys((error as { error?: { errors?: Record<string, string[]> } }).error?.errors ?? {})
        .length > 0
    );
  }

  private fail(key: string, error: unknown): void {
    this.error.set(key);
    this.detail.set(currencyProblemText(error));
  }
}
