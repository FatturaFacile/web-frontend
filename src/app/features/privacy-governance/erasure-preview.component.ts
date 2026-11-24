import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import type { PgErasurePreview } from '@core';
import { TranslatePipe } from '@shared';
import { summarizeErasure } from './privacy-governance.helpers';

/** The result of an erasure (right to be forgotten) dry run: what is anonymised and what the fiscal retention protects. */
@Component({
  selector: 'app-erasure-preview',
  imports: [DatePipe, NzAlertModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    @let data = preview();
    <nz-alert
      nzType="info"
      nzShowIcon
      [nzMessage]="
        (data.dry_run ? 'PRIVACY.ERASURE.DRY_RUN_RESULT' : 'PRIVACY.ERASURE.EXECUTED_RESULT')
          | translate
      "
      [nzDescription]="
        'PRIVACY.ERASURE.SUMMARY'
          | translate
            : {
                anonymize: summary().anonymizeRows,
                protected: summary().protectedRows,
              }
      "
    />

    <h4 data-testid="to-anonymize-title">
      <nz-tag nzColor="green">{{ 'PRIVACY.ERASURE.TO_ANONYMIZE' | translate }}</nz-tag>
    </h4>
    <ul data-testid="to-anonymize-list">
      @for (row of data.to_anonymize; track row.table) {
        <li>
          {{ row.label }} <small>({{ row.module }} / {{ row.table }})</small>:
          <strong>{{ row.rows }}</strong>
        </li>
      } @empty {
        <li>{{ 'PRIVACY.ERASURE.NOTHING' | translate }}</li>
      }
    </ul>

    <h4 data-testid="protected-title">
      <nz-tag nzColor="orange">{{ 'PRIVACY.ERASURE.PROTECTED' | translate }}</nz-tag>
    </h4>
    @if (summary().locked) {
      <nz-alert
        nzType="warning"
        nzShowIcon
        [nzMessage]="'PRIVACY.ERASURE.FISCAL_LOCK' | translate"
      />
    }
    <ul data-testid="protected-list">
      @for (row of data.protected; track row.table) {
        <li>
          {{ row.module }} / {{ row.table }}: <strong>{{ row.rows }}</strong>
          @if (row.retention_ends_at) {
            <small
              >{{ 'PRIVACY.ERASURE.LOCKED_UNTIL' | translate }}
              {{ row.retention_ends_at | date: 'mediumDate' }}</small
            >
          }
        </li>
      } @empty {
        <li>{{ 'PRIVACY.ERASURE.NOTHING' | translate }}</li>
      }
    </ul>

    @if (data.refusal_legal_justification) {
      <nz-alert
        data-testid="refusal"
        nzType="warning"
        nzShowIcon
        [nzMessage]="'PRIVACY.ERASURE.REFUSAL' | translate"
        [nzDescription]="data.refusal_legal_justification"
      />
    }
  `,
})
export class ErasurePreviewComponent {
  readonly preview = input.required<PgErasurePreview>();
  readonly summary = computed(() => summarizeErasure(this.preview()));
}
