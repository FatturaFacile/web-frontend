import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  AccountingImportPayload,
  CONSULTANT_FORMATS,
  ConsultantFormat,
  F24Summary,
  I18nService,
  ItalianPayrollApiService,
  ItalianPayrollPeriod,
  ItalianPayrollStatus,
  ItalianPayrollValidationResult,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';
import { parseEmployeeNets } from './accounting-reconciliation.util';
import { AccountingReconcilerComponent } from './accounting-reconciler.component';
import { CedoliniSplitterComponent } from './cedolini-splitter.component';
import {
  blobErrorMessage,
  defaultExecutionDate,
  exportFilename,
  localIsoDate,
  looksLikeIban,
} from './closing-http.util';
import {
  CLOSING_STEPS,
  ClosingStepId,
  ClosingStepState,
  activeStepIndex,
  closingActions,
  stepState,
} from './closing-workflow.util';

const STATUS_COLORS: Record<ItalianPayrollStatus, string> = {
  attendance_open: 'default',
  validated: 'processing',
  exported_to_cdl: 'processing',
  cedolini_imported: 'warning',
  paid: 'success',
};

/**
 * Monthly closing hub of the Italian payroll: one stepper from the attendance collection to the SEPA salaries, and
 * under it the card of each stage. The buttons open only for what the API accepts in the current state, so the
 * order of the workflow is visible instead of being learnt from 422 answers.
 */
@Component({
  selector: 'app-italian-payroll-closing-hub',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    AccountingReconcilerComponent,
    CedoliniSplitterComponent,
  ],
  template: `
    <header class="toolbar">
      <div class="field">
        <label for="ipp-period">{{ 'itPayroll.period.select' | translate }}</label>
        <nz-select
          nzId="ipp-period"
          class="period-select"
          [nzPlaceHolder]="'itPayroll.period.none' | translate"
          [ngModel]="selectedId()"
          (ngModelChange)="select($event)"
        >
          @for (item of periods(); track item.id) {
            <nz-option [nzValue]="item.id" [nzLabel]="periodLabel(item)" />
          }
        </nz-select>
      </div>

      <form class="new-period" (ngSubmit)="createPeriod()">
        <div class="field">
          <label for="ipp-year">{{ 'itPayroll.period.year' | translate }}</label>
          <input
            nz-input
            id="ipp-year"
            type="number"
            min="2000"
            max="2100"
            [ngModel]="newYear()"
            (ngModelChange)="newYear.set($event)"
            name="year"
          />
        </div>
        <div class="field">
          <label for="ipp-month">{{ 'itPayroll.period.month' | translate }}</label>
          <input
            nz-input
            id="ipp-month"
            type="number"
            min="1"
            max="12"
            [ngModel]="newMonth()"
            (ngModelChange)="newMonth.set($event)"
            name="month"
          />
        </div>
        <label
          nz-checkbox
          nzId="ipp-tredicesima"
          for="ipp-tredicesima"
          [ngModel]="newTredicesima()"
          (ngModelChange)="newTredicesima.set($event)"
          name="tredicesima"
        >
          {{ 'itPayroll.period.tredicesima' | translate }}
        </label>
        <label
          nz-checkbox
          nzId="ipp-quattordicesima"
          for="ipp-quattordicesima"
          [ngModel]="newQuattordicesima()"
          (ngModelChange)="newQuattordicesima.set($event)"
          name="quattordicesima"
        >
          {{ 'itPayroll.period.quattordicesima' | translate }}
        </label>
        <button
          nz-button
          type="submit"
          [disabled]="!validNewPeriod() || creating()"
          [nzLoading]="creating()"
          data-testid="create-period"
        >
          {{ 'itPayroll.period.create' | translate }}
        </button>
      </form>
    </header>

    @if (period(); as p) {
      <nz-steps
        class="stepper"
        nzSize="small"
        [nzCurrent]="stepIndex()"
        data-testid="closing-stepper"
      >
        @for (step of steps(); track step.id) {
          <nz-step [nzTitle]="'itPayroll.step.' + step.id | translate" [nzStatus]="step.state" />
        }
      </nz-steps>

      <nz-card
        class="stage"
        [nzTitle]="'itPayroll.attendance.title' | translate"
        data-testid="stage-attendance"
      >
        <p>{{ 'itPayroll.attendance.help' | translate }}</p>
        <nz-tag [nzColor]="statusColor(p.status)" data-testid="period-status">{{
          'itPayroll.status.' + p.status | translate
        }}</nz-tag>
        @if (p.include_tredicesima) {
          <nz-tag>{{ 'itPayroll.period.tredicesima' | translate }}</nz-tag>
        }
        @if (p.include_quattordicesima) {
          <nz-tag>{{ 'itPayroll.period.quattordicesima' | translate }}</nz-tag>
        }
      </nz-card>

      <nz-card
        class="stage"
        [nzTitle]="'itPayroll.validation.title' | translate"
        data-testid="stage-validation"
      >
        <p>{{ 'itPayroll.validation.help' | translate }}</p>
        @if (actions().validate) {
          <label for="ipp-fringe">{{ 'itPayroll.validation.fringe' | translate }}</label>
          <textarea
            nz-input
            id="ipp-fringe"
            rows="3"
            [ngModel]="fringeText()"
            (ngModelChange)="fringeText.set($event)"
          ></textarea>
          <p class="hint">{{ 'itPayroll.validation.fringeHint' | translate }}</p>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="validating()"
            [nzLoading]="validating()"
            (click)="validate()"
            data-testid="validate"
          >
            {{ 'itPayroll.validation.run' | translate }}
          </button>
        }
        <div aria-live="polite" data-testid="validation-report">
          @if (validation(); as v) {
            <p>{{ 'itPayroll.validation.lines' | translate: { count: v.line_count } }}</p>
          }
          @if (report(); as r) {
            @if (!r.errors.length && !r.warnings.length) {
              <nz-alert
                nzType="success"
                nzShowIcon
                [nzMessage]="'itPayroll.validation.ok' | translate"
              />
            }
            @if (r.errors.length) {
              <nz-alert
                nzType="error"
                nzShowIcon
                [nzMessage]="'itPayroll.validation.errors' | translate: { count: r.errors.length }"
              />
              <ul class="issues" data-testid="validation-errors">
                @for (issue of r.errors; track $index) {
                  <li>{{ issue.message }}</li>
                }
              </ul>
            }
            @if (r.warnings.length) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="
                  'itPayroll.validation.warnings' | translate: { count: r.warnings.length }
                "
              />
              <ul class="issues" data-testid="validation-warnings">
                @for (issue of r.warnings; track $index) {
                  <li>{{ issue.message }}</li>
                }
              </ul>
            }
          }
        </div>
      </nz-card>

      <nz-card
        class="stage"
        [nzTitle]="'itPayroll.export.title' | translate"
        data-testid="stage-export"
      >
        <p>{{ 'itPayroll.export.help' | translate }}</p>
        <div class="row">
          <div class="field">
            <label for="ipp-format">{{ 'itPayroll.export.format' | translate }}</label>
            <nz-select
              nzId="ipp-format"
              [ngModel]="format()"
              (ngModelChange)="format.set($event)"
              [nzDisabled]="!actions().exportFile"
            >
              @for (item of formats; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'itPayroll.format.' + item | translate" />
              }
            </nz-select>
          </div>
          <div class="field">
            <label for="ipp-company">{{ 'itPayroll.export.company' | translate }}</label>
            <input
              nz-input
              id="ipp-company"
              maxlength="6"
              autocomplete="off"
              [disabled]="!actions().exportFile"
              [ngModel]="companyCode()"
              (ngModelChange)="companyCode.set(($event ?? '').toUpperCase())"
            />
          </div>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!actions().exportFile || !validCompany() || exporting()"
            [nzLoading]="exporting()"
            (click)="exportFile()"
            data-testid="export"
          >
            {{ 'itPayroll.export.download' | translate }}
          </button>
        </div>
        <p class="hint">{{ 'itPayroll.export.companyHint' | translate }}</p>
      </nz-card>

      <nz-card
        class="stage"
        [nzTitle]="'itPayroll.import.title' | translate"
        data-testid="stage-import"
      >
        <p>{{ 'itPayroll.import.help' | translate }}</p>
        <app-cedolini-splitter
          [periodId]="p.id"
          [disabled]="!actions().importCedolini"
          (imported)="refreshPeriod()"
        />
        <h4 class="section">{{ 'itPayroll.reconciler.title' | translate }}</h4>
        <app-accounting-reconciler
          [disabled]="!actions().importAccounting"
          [busy]="accountingBusy()"
          [companyId]="p.legal_entity_id"
          (submitted)="importAccounting($event)"
        />
        @if (f24(); as f) {
          <h4 class="section">{{ 'itPayroll.f24.title' | translate }}</h4>
          <p>{{ 'itPayroll.f24.due' | translate: { date: f.due_date } }}</p>
          <nz-table
            #f24Table
            [nzData]="f.lines"
            nzSize="small"
            [nzShowPagination]="false"
            data-testid="f24-table"
          >
            <thead>
              <tr>
                <th>{{ 'itPayroll.f24.section' | translate }}</th>
                <th>{{ 'itPayroll.f24.code' | translate }}</th>
                <th>{{ 'itPayroll.f24.description' | translate }}</th>
                <th class="num">{{ 'itPayroll.f24.amount' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of f24Table.data; track line.tax_code) {
                <tr>
                  <td>{{ 'itPayroll.f24.sections.' + line.section | translate }}</td>
                  <td>{{ line.tax_code }}</td>
                  <td>{{ line.description }}</td>
                  <td class="num">{{ line.amount | money: 'EUR' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <p class="num">
            <strong>{{ 'itPayroll.f24.total' | translate }}: {{ f.total | money: 'EUR' }}</strong>
          </p>
        }
      </nz-card>

      <nz-card
        class="stage"
        [nzTitle]="'itPayroll.sepa.title' | translate"
        data-testid="stage-sepa"
      >
        <p>{{ 'itPayroll.sepa.help' | translate }}</p>
        <div class="row">
          <div class="field">
            <label for="ipp-debtor">{{ 'itPayroll.sepa.debtorName' | translate }}</label>
            <input
              nz-input
              id="ipp-debtor"
              maxlength="70"
              [disabled]="!actions().sepa"
              [ngModel]="debtorName()"
              (ngModelChange)="debtorName.set($event)"
            />
          </div>
          <div class="field">
            <label for="ipp-iban">{{ 'itPayroll.sepa.iban' | translate }}</label>
            <input
              nz-input
              id="ipp-iban"
              maxlength="42"
              autocomplete="off"
              [disabled]="!actions().sepa"
              [ngModel]="debtorIban()"
              (ngModelChange)="debtorIban.set($event)"
            />
          </div>
          <div class="field">
            <label for="ipp-bic">{{ 'itPayroll.sepa.bic' | translate }}</label>
            <input
              nz-input
              id="ipp-bic"
              maxlength="11"
              autocomplete="off"
              [disabled]="!actions().sepa"
              [ngModel]="debtorBic()"
              (ngModelChange)="debtorBic.set(($event ?? '').toUpperCase())"
            />
          </div>
          <div class="field">
            <label for="ipp-date">{{ 'itPayroll.sepa.date' | translate }}</label>
            <input
              nz-input
              id="ipp-date"
              type="date"
              [min]="today"
              [disabled]="!actions().sepa"
              [ngModel]="executionDate()"
              (ngModelChange)="executionDate.set($event)"
            />
          </div>
        </div>
        <div class="row">
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!actions().sepa || !validSepa() || sepaBusy()"
            [nzLoading]="sepaBusy()"
            (click)="generateSepa()"
            data-testid="sepa"
          >
            {{ 'itPayroll.sepa.generate' | translate }}
          </button>
          <button
            nz-button
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'itPayroll.sepa.markPaidConfirm' | translate"
            [disabled]="!actions().markPaid || paying()"
            (nzOnConfirm)="markPaid()"
            data-testid="mark-paid"
          >
            {{ 'itPayroll.sepa.markPaid' | translate }}
          </button>
        </div>
        @if (p.status === 'paid') {
          <nz-alert
            class="stage-alert"
            nzType="success"
            nzShowIcon
            [nzMessage]="'itPayroll.sepa.paid' | translate"
            data-testid="paid-banner"
          />
        }
      </nz-card>
    } @else {
      <nz-alert
        nzType="info"
        nzShowIcon
        [nzMessage]="'itPayroll.period.none' | translate"
        data-testid="no-period"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: flex-end;
      margin-bottom: 24px;
    }
    .new-period,
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .period-select {
      min-width: 240px;
    }
    .stepper {
      margin-bottom: 24px;
    }
    .stage {
      margin-bottom: 16px;
    }
    .stage-alert,
    .section {
      margin-top: 16px;
    }
    .issues {
      margin: 8px 0 0;
      padding-left: 20px;
    }
    .hint {
      margin: 4px 0 8px;
      opacity: 0.75;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class ItalianPayrollClosingHubComponent {
  private readonly api = inject(ItalianPayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formats = CONSULTANT_FORMATS;
  protected readonly today = localIsoDate(new Date());

  protected readonly periods = signal<ItalianPayrollPeriod[]>([]);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly newYear = signal<number | null>(new Date().getFullYear());
  protected readonly newMonth = signal<number | null>(new Date().getMonth() + 1);
  protected readonly newTredicesima = signal(false);
  protected readonly newQuattordicesima = signal(false);
  protected readonly creating = signal(false);

  protected readonly fringeText = signal('');
  protected readonly validating = signal(false);
  protected readonly validation = signal<ItalianPayrollValidationResult | null>(null);

  protected readonly format = signal<ConsultantFormat>('zucchetti');
  protected readonly companyCode = signal('');
  protected readonly exporting = signal(false);

  protected readonly accountingBusy = signal(false);
  protected readonly f24 = signal<F24Summary | null>(null);

  protected readonly debtorName = signal('');
  protected readonly debtorIban = signal('');
  protected readonly debtorBic = signal('');
  protected readonly executionDate = signal(defaultExecutionDate());
  protected readonly sepaBusy = signal(false);
  protected readonly paying = signal(false);

  protected readonly period = computed(
    () => this.periods().find((item) => item.id === this.selectedId()) ?? null,
  );
  protected readonly actions = computed(() => {
    const current = this.period();

    return current
      ? closingActions(current)
      : {
          validate: false,
          exportFile: false,
          importCedolini: false,
          importAccounting: false,
          sepa: false,
          markPaid: false,
        };
  });
  protected readonly stepIndex = computed(() => {
    const current = this.period();

    return current ? activeStepIndex(current) : 0;
  });
  protected readonly steps = computed<{ id: ClosingStepId; state: ClosingStepState }[]>(() => {
    const current = this.period();

    return CLOSING_STEPS.map((id, index) => ({
      id,
      state: current ? stepState(current, index) : 'wait',
    }));
  });

  /** The fresh validation answer if the user just ran one, else the report stored on the period. */
  protected readonly report = computed(
    () => this.validation() ?? this.period()?.validation_report ?? null,
  );

  protected readonly validNewPeriod = computed(() => {
    const year = this.newYear();
    const month = this.newMonth();

    return (
      year !== null && month !== null && year >= 2000 && year <= 2100 && month >= 1 && month <= 12
    );
  });
  protected readonly validCompany = computed(() => /^[A-Z0-9]{1,6}$/.test(this.companyCode()));
  protected readonly validSepa = computed(
    () =>
      this.debtorName().trim() !== '' &&
      looksLikeIban(this.debtorIban()) &&
      (this.debtorBic() === '' || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(this.debtorBic())) &&
      this.executionDate() >= this.today,
  );

  constructor() {
    this.reload();
  }

  protected periodLabel(item: ItalianPayrollPeriod): string {
    return `${String(item.month).padStart(2, '0')}/${item.year} · ${this.i18n.translate(`itPayroll.status.${item.status}`)}`;
  }

  protected statusColor(status: ItalianPayrollStatus): string {
    return STATUS_COLORS[status];
  }

  protected select(id: string | null): void {
    this.selectedId.set(id);
    this.validation.set(null);
    this.f24.set(null);
    this.loadF24IfPosted();
  }

  protected createPeriod(): void {
    if (!this.validNewPeriod() || this.creating()) {
      return;
    }

    this.creating.set(true);
    this.api
      .createPeriod({
        year: Number(this.newYear()),
        month: Number(this.newMonth()),
        include_tredicesima: this.newTredicesima(),
        include_quattordicesima: this.newQuattordicesima(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.creating.set(false);
          this.periods.update((list) => [res.data, ...list]);
          this.select(res.data.id);
        },
        error: (err: unknown) => {
          this.creating.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  protected validate(): void {
    const current = this.period();

    if (!current || this.validating()) {
      return;
    }

    const parsed = parseEmployeeNets(this.fringeText());

    if (parsed.errors.length > 0) {
      this.message.error(
        this.i18n.translate('itPayroll.validation.fringeInvalid', { line: parsed.errors[0].line }),
      );

      return;
    }

    this.validating.set(true);
    this.api
      .validateAttendance(
        current.id,
        parsed.rows.map((row) => ({ employee_id: row.employee_id, amount: row.net_amount })),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.validating.set(false);
          this.validation.set(res.data);
          this.refreshPeriod();
        },
        error: (err: unknown) => {
          this.validating.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  protected exportFile(): void {
    const current = this.period();

    if (!current || this.exporting() || !this.validCompany()) {
      return;
    }

    this.exporting.set(true);
    this.api
      .exportAttendance(current.id, this.format(), this.companyCode())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.exporting.set(false);
          saveBlob(
            blob,
            exportFilename(this.format(), this.companyCode(), current.year, current.month),
          );
          this.message.success(this.i18n.translate('itPayroll.export.done'));
          this.refreshPeriod();
        },
        error: (err: unknown) => {
          this.exporting.set(false);
          void this.reportBlobError(err);
        },
      });
  }

  protected importAccounting(payload: AccountingImportPayload): void {
    const current = this.period();

    if (!current || this.accountingBusy()) {
      return;
    }

    this.accountingBusy.set(true);
    this.api
      .importAccounting(current.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.accountingBusy.set(false);
          this.message.success(this.i18n.translate('itPayroll.reconciler.imported'));
          this.refreshPeriod();
          this.loadF24(current.id);
        },
        error: (err: unknown) => {
          this.accountingBusy.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  protected generateSepa(): void {
    const current = this.period();

    if (!current || this.sepaBusy() || !this.validSepa()) {
      return;
    }

    this.sepaBusy.set(true);
    this.api
      .generateSepa(current.id, {
        debtor_name: this.debtorName().trim(),
        debtor_iban: this.debtorIban().replace(/\s+/g, '').toUpperCase(),
        debtor_bic: this.debtorBic() || null,
        execution_date: this.executionDate(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.sepaBusy.set(false);
          saveBlob(blob, `SALARI_${current.year}${String(current.month).padStart(2, '0')}.xml`);
          this.message.success(this.i18n.translate('itPayroll.sepa.done'));
        },
        error: (err: unknown) => {
          this.sepaBusy.set(false);
          void this.reportBlobError(err);
        },
      });
  }

  protected markPaid(): void {
    const current = this.period();

    if (!current || this.paying()) {
      return;
    }

    this.paying.set(true);
    this.api
      .markPaid(current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.paying.set(false);
          this.replace(res.data);
        },
        error: (err: unknown) => {
          this.paying.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  /** Reads the period again: the status moves on the server (payslips imported, month exported, validated). */
  protected refreshPeriod(): void {
    const id = this.selectedId();

    if (!id) {
      return;
    }

    this.api
      .getPeriod(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.replace(res.data),
        error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
      });
  }

  private reload(): void {
    this.api
      .getPeriods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.periods.set(res.data);

          if (res.data.length > 0 && this.selectedId() === null) {
            this.select(res.data[0].id);
          }
        },
        error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
      });
  }

  private replace(updated: ItalianPayrollPeriod): void {
    this.periods.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    this.loadF24IfPosted();
  }

  private loadF24IfPosted(): void {
    const current = this.period();

    if (current?.accounting_imported && this.f24() === null) {
      this.loadF24(current.id);
    }
  }

  private loadF24(id: string): void {
    this.api
      .getF24(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.f24.set(res.data),
        // The summary is a convenience: a failure here must not hide the rest of the page.
        error: () => this.f24.set(null),
      });
  }

  private async reportBlobError(err: unknown): Promise<void> {
    const detail = await blobErrorMessage(err);

    if (detail) {
      this.message.error(detail);
    } else {
      reportHttpError(err, this.message, this.i18n);
    }
  }
}
