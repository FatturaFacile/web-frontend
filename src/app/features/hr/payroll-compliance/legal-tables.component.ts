import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { I18nService, PayrollComplianceApiService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { defer, map, Observable, tap, throwError } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig } from '../shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

const LEGAL_TOPICS = [
  'frontier_italy',
  'short_time_work',
  'bad_weather',
  'withholding_tax_statement',
];
const COUNTRIES = ['CH', 'IT'];

/** The parameters travel as a JSON object: a text that does not parse is reported on the page as a 422. */
function parseJsonObject(text: unknown): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(String(text ?? ''));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Legal parameters by topic and year, and the annual payroll parameters by country and year (company overrides). */
@Component({
  selector: 'app-legal-tables',
  imports: [NzAlertModule, TranslatePipe, CrudTableComponent],
  template: `
    <nz-alert
      nzType="info"
      nzShowIcon
      class="mb-3"
      [nzMessage]="'hrmCompliance.legal.hint' | translate"
    />
    <app-crud-table [config]="legalConfig()" />
    <div class="mt-4">
      <app-crud-table [config]="annualConfig()" />
    </div>
  `,
})
export class LegalTablesComponent {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollComplianceApiService);
  private readonly i18n = inject(I18nService);
  private readonly legalRows = signal<Row[]>([]);
  private readonly annualRows = signal<Row[]>([]);

  protected readonly legalConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmCompliance.legal.legalTitle',
    canWrite: this.canWrite(),
    list: () =>
      this.api.getLegalParameters().pipe(
        map((res) =>
          res.data.map((r) => ({ ...r, parameters: JSON.stringify(r.parameters ?? {}) }) as Row),
        ),
        tap((rows) => this.legalRows.set(rows)),
      ),
    create: (payload) => this.saveLegal(String(payload['topic']), Number(payload['year']), payload),
    update: (id, payload) => {
      const row = this.legalRows().find((r) => r.id === id);
      return this.saveLegal(String(row?.['topic']), Number(row?.['year']), payload);
    },
    fields: [
      {
        key: 'topic',
        labelKey: 'hrmCompliance.legal.topic',
        type: 'select',
        required: true,
        createOnly: true,
        options: () =>
          LEGAL_TOPICS.map((value) => ({ value, labelKey: `hrmCompliance.legal.topics.${value}` })),
      },
      {
        key: 'year',
        labelKey: 'hrmCommon.year',
        type: 'integer',
        required: true,
        createOnly: true,
      },
      {
        key: 'source',
        labelKey: 'hrmCompliance.legal.source',
        type: 'text',
        required: true,
        maxLength: 2000,
      },
      {
        key: 'parameters',
        labelKey: 'hrmCompliance.legal.parameters',
        type: 'textarea',
        required: true,
        column: false,
      },
    ],
  }));

  protected readonly annualConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmCompliance.legal.annualTitle',
    canWrite: this.canWrite(),
    list: () =>
      this.api.getAnnualParameters().pipe(
        map((res) =>
          res.data.map((r) => ({ ...r, parameters: JSON.stringify(r.parameters ?? {}) }) as Row),
        ),
        tap((rows) => this.annualRows.set(rows)),
      ),
    create: (payload) =>
      this.saveAnnual(String(payload['country']), Number(payload['year']), payload),
    update: (id, payload) => {
      const row = this.annualRows().find((r) => r.id === id);
      return this.saveAnnual(String(row?.['country']), Number(row?.['year']), payload);
    },
    fields: [
      {
        key: 'country',
        labelKey: 'hrmPayroll.country',
        type: 'select',
        required: true,
        createOnly: true,
        options: () => COUNTRIES.map((value) => ({ value, label: value })),
      },
      {
        key: 'year',
        labelKey: 'hrmCommon.year',
        type: 'integer',
        required: true,
        createOnly: true,
      },
      {
        key: 'legal_reference',
        labelKey: 'hrmCompliance.legal.legalReference',
        type: 'text',
        nullable: true,
        maxLength: 255,
      },
      {
        key: 'parameters',
        labelKey: 'hrmCompliance.legal.annualParameters',
        type: 'textarea',
        required: true,
        column: false,
      },
    ],
  }));

  private invalidJson(): Observable<never> {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 422,
          error: { detail: this.i18n.translate('hrmCompliance.legal.invalidJson') },
        }),
    );
  }

  private saveLegal(
    topic: string,
    year: number,
    payload: Record<string, unknown>,
  ): Observable<unknown> {
    return defer(() => {
      const parameters = parseJsonObject(payload['parameters']);
      return parameters
        ? this.api.saveLegalParameters(topic, year, {
            parameters,
            source: String(payload['source'] ?? ''),
          })
        : this.invalidJson();
    });
  }

  private saveAnnual(
    country: string,
    year: number,
    payload: Record<string, unknown>,
  ): Observable<unknown> {
    return defer(() => {
      const parameters = parseJsonObject(payload['parameters']) as Record<string, number> | null;
      return parameters
        ? this.api.saveAnnualParameters(country, year, {
            parameters,
            legal_reference: (payload['legal_reference'] as string | null | undefined) ?? null,
          })
        : this.invalidJson();
    });
  }
}
