import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ClosingStage,
  ClosingStageStatus,
  I18nService,
  LEDGER_BOOK_CODES,
  LedgerBookCode,
  PermissionsService,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { YearEndClosingStore } from './gl-year-end-closing.store';

type StepStatus = 'wait' | 'process' | 'finish' | 'error';

const STEP_STATUS: Record<ClosingStageStatus, StepStatus> = {
  completed: 'finish',
  ready: 'process',
  blocked: 'wait',
};
const STATUS_COLOR: Record<ClosingStageStatus, string> = {
  completed: 'green',
  ready: 'blue',
  blocked: 'default',
};

/** Year-end closing wizard: four stages per fiscal year and ledger book, each run once, in order, after a confirmation. */
@Component({
  selector: 'app-gl-year-end-closing',
  providers: [YearEndClosingStore],
  imports: [
    FormsModule,
    RouterLink,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzSelectModule,
    NzStepsModule,
    NzTagModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  styles: `
    .yec-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: center;
      margin-bottom: 16px;
    }
    .yec-select {
      min-width: 220px;
    }
    .yec-stage {
      margin-top: 16px;
    }
    .yec-summary {
      margin: 8px 0;
      padding-left: 20px;
    }
  `,
  template: `
    <nz-card [nzTitle]="'GL.YEC_TITLE' | translate">
      <app-gl-error-alert [error]="store.error()" />

      <div class="yec-filters">
        <label for="yec-year">{{ 'GL.YEC_FISCAL_YEAR' | translate }}</label>
        <nz-select
          id="yec-year"
          class="yec-select"
          [nzPlaceHolder]="'GL.YEC_SELECT_YEAR' | translate"
          [ngModel]="store.fiscalYearId()"
          (ngModelChange)="store.selectYear($event)"
        >
          @for (year of store.fiscalYears(); track year.id) {
            <nz-option
              [nzValue]="year.id"
              [nzLabel]="year.year_code + ' (' + year.start_date + ' / ' + year.end_date + ')'"
            />
          }
        </nz-select>
        <label for="yec-ledger">{{ 'GL.PN_BOOK' | translate }}</label>
        <nz-select
          id="yec-ledger"
          class="yec-select"
          [ngModel]="store.ledger()"
          (ngModelChange)="store.selectLedger($event)"
        >
          @for (code of books; track code) {
            <nz-option [nzValue]="code" [nzLabel]="'GL.PN_BOOK_' + code | translate" />
          }
        </nz-select>
        @if (store.workflow(); as workflow) {
          <nz-tag [nzColor]="workflow.is_complete ? 'green' : 'blue'">
            {{
              workflow.is_complete
                ? ('GL.YEC_COMPLETE' | translate)
                : store.completedCount() + ' / ' + workflow.stages.length
            }}
          </nz-tag>
        }
      </div>

      @if (store.workflow()) {
        <nz-steps [nzCurrent]="store.currentIndex()" nzSize="small">
          @for (stage of store.stages(); track stage.stage) {
            <nz-step [nzTitle]="stageTitleKey(stage) | translate" [nzStatus]="stepStatus(stage)" />
          }
        </nz-steps>

        @for (stage of store.stages(); track stage.stage) {
          <nz-card
            class="yec-stage"
            nzSize="small"
            [nzTitle]="stage.stage + '. ' + (stageTitleKey(stage) | translate)"
            [attr.data-stage]="stage.stage"
          >
            <nz-tag [nzColor]="statusColor(stage.status)">{{
              'GL.YEC_STATUS_' + stage.status.toUpperCase() | translate
            }}</nz-tag>
            <p>{{ 'GL.YEC_STAGE_DESC_' + stage.key.toUpperCase() | translate }}</p>
            @if (summaryEntries(stage).length > 0) {
              <ul class="yec-summary">
                @for (entry of summaryEntries(stage); track entry.key) {
                  <li>{{ entry.key }}: {{ entry.value }}</li>
                }
              </ul>
            }
            @if (stage.executed_at) {
              <p>{{ 'GL.YEC_EXECUTED_AT' | translate }}: {{ stage.executed_at }}</p>
            }
            @if (stage.journal_entry_id) {
              <a
                [routerLink]="['/general-ledger/journals']"
                [queryParams]="{ entry: stage.journal_entry_id }"
                >{{ 'GL.YEC_OPEN_JOURNAL' | translate }}</a
              >
            }
            @if (stage.status === 'ready' && canWrite) {
              <button
                nz-button
                nzType="primary"
                type="button"
                data-testid="yec-run"
                [nzLoading]="store.running() === stage.stage"
                [disabled]="store.running() !== null"
                (click)="store.askConfirmation(stage.stage)"
              >
                {{ 'GL.YEC_RUN_STAGE' | translate }}
              </button>
            }
          </nz-card>
        }
      }
    </nz-card>

    <nz-modal appModalActions
      [nzVisible]="store.pendingStage() !== null"
      [nzTitle]="'GL.YEC_CONFIRM_TITLE' | translate"
      [nzOkDanger]="true"
      (nzOnOk)="confirm()"
      (nzOnCancel)="store.cancelConfirmation()"
      okAction="confirm"
    >
      <ng-container *nzModalContent>
        <p>{{ 'GL.YEC_CONFIRM_TEXT' | translate }}</p>
      </ng-container>
    </nz-modal>
  `,
})
export class GlYearEndClosingComponent {
  protected readonly store = inject(YearEndClosingStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly books: readonly LedgerBookCode[] = LEDGER_BOOK_CODES;

  constructor() {
    void this.store.loadYears();
  }

  protected stageTitleKey(stage: ClosingStage): string {
    return 'GL.YEC_STAGE_' + stage.key.toUpperCase();
  }

  protected stepStatus(stage: ClosingStage): StepStatus {
    return STEP_STATUS[stage.status];
  }

  protected statusColor(status: ClosingStageStatus): string {
    return STATUS_COLOR[status];
  }

  protected summaryEntries(stage: ClosingStage): { key: string; value: string }[] {
    return Object.entries(stage.summary ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
    }));
  }

  protected async confirm(): Promise<void> {
    if (await this.store.confirmStage()) {
      this.message.success(this.i18n.translate('GL.YEC_STAGE_DONE'));
    }
  }
}
