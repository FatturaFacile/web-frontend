import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import {
  HrTimeApiService,
  I18nService,
  PunchImportItem,
  PunchImportResult,
  PunchType,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { defer, Observable, tap, throwError } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';

const PUNCH_TYPES: PunchType[] = ['In', 'Out', 'BreakStart', 'BreakEnd', 'Meal'];
const SOURCES = ['badge', 'terminal'];

/** Imports the punches of a badge reader or terminal. One punch per line: `external_id;badge_code;occurred_at;punch_type;meal_type`. */
@Component({
  selector: 'app-time-punch-import',
  styleUrl: './time-punch-import.component.scss',
  imports: [ActionFormComponent, NzAlertModule, NzTableModule, TranslatePipe],
  template: `
    <nz-alert
      nzType="info"
      nzShowIcon
      class="mb-3"
      [nzMessage]="'hrmTimeX.punchHint' | translate"
    />
    <app-action-form [config]="config" [canWrite]="canWrite()" />
    @if (result(); as r) {
      <p class="mt-3">
        {{
          'hrmTimeX.punchResult'
            | translate
              : { accepted: r.accepted, duplicates: r.duplicates, rejected: r.rejected.length }
        }}
      </p>
      @if (r.rejected.length > 0) {
        <nz-table #rejectedTable [nzData]="r.rejected" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmTimeX.externalId' | translate }}</th>
              <th>{{ 'hrmCommon.reason' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rejectedTable.data; track row.external_id) {
              <tr>
                <td>{{ row.external_id }}</td>
                <td>{{ row.reason }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }
  `,
})
export class TimePunchImportComponent {
  readonly canWrite = input(false);

  private readonly api = inject(HrTimeApiService);
  private readonly i18n = inject(I18nService);

  protected readonly result = signal<PunchImportResult | null>(null);

  protected readonly config: ActionFormConfig = {
    submitLabelKey: 'hrmTimeX.importPunches',
    successKey: 'hrmTimeX.punchImported',
    fields: [
      {
        key: 'reader_id',
        labelKey: 'hrmTimeX.readerId',
        type: 'text',
        required: true,
        maxLength: 120,
      },
      {
        key: 'source',
        labelKey: 'hrmTime.source',
        type: 'select',
        defaultValue: 'terminal',
        options: () =>
          SOURCES.map((value) => ({ value, labelKey: `hrmTime.sourceValue.${value}` })),
      },
      { key: 'punches', labelKey: 'hrmTimeX.punches', type: 'textarea', required: true },
    ],
    submit: (payload) => this.import(payload),
  };

  private import(payload: Record<string, unknown>): Observable<unknown> {
    return defer(() => {
      const punches = this.parse(String(payload['punches'] ?? ''));
      if (!punches) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: this.i18n.translate('hrmTimeX.punchInvalid') },
            }),
        );
      }
      return this.api
        .importPunches({
          reader_id: String(payload['reader_id']),
          source: (payload['source'] as 'badge' | 'terminal' | undefined) ?? 'terminal',
          punches,
        })
        .pipe(tap((res) => this.result.set(res.data)));
    });
  }

  /** Null when a line is incomplete or has an unknown punch type. */
  private parse(text: string): PunchImportItem[] | null {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    const punches: PunchImportItem[] = [];
    for (const line of lines) {
      const [externalId, badgeCode, occurredAt, punchType, mealType] = line
        .split(/[;,]/)
        .map((part) => part.trim());
      if (!externalId || !occurredAt || !PUNCH_TYPES.includes(punchType as PunchType)) {
        return null;
      }
      punches.push({
        external_id: externalId,
        badge_code: badgeCode || null,
        occurred_at: occurredAt,
        punch_type: punchType as PunchType,
        ...(mealType ? { meal_type: mealType } : {}),
      });
    }
    return punches.length > 0 ? punches : null;
  }
}
