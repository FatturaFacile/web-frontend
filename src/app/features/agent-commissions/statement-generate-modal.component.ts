import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AGC_PERIOD_TYPES, AgcGeneratePayload, AgcPeriodType, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import {
  AgcOutcome,
  currentMonth,
  currentQuarter,
  PeriodInput,
  periodOf,
  selectableYears,
  summaryOfPreview,
} from './agent-commissions.util';
import { StatementSummaryComponent } from './statement-summary.component';
import { StatementsStore } from './statements.store';

/** The request of the dialog, or null while the agent or the period is missing or invalid. */
export function generatePayloadOf(
  agentId: string | null,
  input: PeriodInput,
): AgcGeneratePayload | null {
  const bounds = periodOf(input);
  if (agentId === null || bounds === null) {
    return null;
  }
  return {
    agent_profile_id: agentId,
    period_start: bounds.start,
    period_end: bounds.end,
    period_type: input.type,
  };
}

/**
 * Generates the commission statement of an agent for a period. Every time the agent or the period changes the dialog asks
 * the API for the preview (nothing is saved) and shows the full breakdown, so the figures are seen before the statement
 * is drawn.
 */
@Component({
  selector: 'app-statement-generate-modal',
  imports: [
    FormsModule,
    StatementSummaryComponent,
    TranslatePipe,
    NzAlertModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzWidth]="720"
      [nzTitle]="'agentCommissions.statements.generateTitle' | translate"
      [nzOkText]="'agentCommissions.action.generate' | translate"
      [nzCancelText]="'agentCommissions.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!canGenerate()"
      (nzOnOk)="generate()"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        @if (error(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? '' | translate"
          ></nz-alert>
        }

        <div class="editor">
          <label class="field wide" for="agc-gen-agent">
            <span>{{ 'agentCommissions.field.agent' | translate }}</span>
            <nz-select
              nzId="agc-gen-agent"
              nzShowSearch
              [ngModel]="agentId()"
              (ngModelChange)="agentId.set($event ?? null)"
            >
              @for (option of store.agentOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-gen-type">
            <span>{{ 'agentCommissions.field.periodType' | translate }}</span>
            <nz-select nzId="agc-gen-type" [ngModel]="type()" (ngModelChange)="type.set($event)">
              @for (option of periodTypes; track option) {
                <nz-option
                  [nzValue]="option"
                  [nzLabel]="'agentCommissions.periodType.' + option | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          @switch (type()) {
            @case ('monthly') {
              <label class="field" for="agc-gen-month">
                <span>{{ 'agentCommissions.field.month' | translate }}</span>
                <input
                  nz-input
                  id="agc-gen-month"
                  type="month"
                  [ngModel]="month()"
                  (ngModelChange)="month.set($event)"
                />
              </label>
            }
            @case ('quarterly') {
              <label class="field" for="agc-gen-year">
                <span>{{ 'agentCommissions.field.year' | translate }}</span>
                <nz-select
                  nzId="agc-gen-year"
                  [ngModel]="year()"
                  (ngModelChange)="year.set($event)"
                >
                  @for (option of years; track option) {
                    <nz-option [nzValue]="option" [nzLabel]="'' + option"></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="agc-gen-quarter">
                <span>{{ 'agentCommissions.field.quarter' | translate }}</span>
                <nz-select
                  nzId="agc-gen-quarter"
                  [ngModel]="quarter()"
                  (ngModelChange)="quarter.set($event)"
                >
                  @for (option of quarters; track option) {
                    <nz-option [nzValue]="option" [nzLabel]="'' + option"></nz-option>
                  }
                </nz-select>
              </label>
            }
            @default {
              <label class="field" for="agc-gen-from">
                <span>{{ 'agentCommissions.field.from' | translate }}</span>
                <input
                  nz-input
                  id="agc-gen-from"
                  type="date"
                  [ngModel]="from()"
                  (ngModelChange)="from.set($event)"
                />
              </label>
              <label class="field" for="agc-gen-to">
                <span>{{ 'agentCommissions.field.to' | translate }}</span>
                <input
                  nz-input
                  id="agc-gen-to"
                  type="date"
                  [ngModel]="to()"
                  (ngModelChange)="to.set($event)"
                />
              </label>
            }
          }
        </div>

        <h4 class="preview-title">{{ 'agentCommissions.statements.previewTitle' | translate }}</h4>
        @if (store.previewError(); as previewError) {
          <nz-alert nzType="warning" nzShowIcon [nzMessage]="previewError | translate"></nz-alert>
        }
        <nz-spin [nzSpinning]="store.previewing()">
          <app-statement-summary [summary]="summary()"></app-statement-summary>
        </nz-spin>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .preview-title {
      margin: 24px 0 8px;
    }
  `,
})
export class StatementGenerateModalComponent {
  readonly store = inject(StatementsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input.required<boolean>();
  readonly closed = output<void>();
  /** Emits the id of the statement that was generated. */
  readonly generated = output<string>();

  readonly periodTypes = AGC_PERIOD_TYPES;
  readonly years = selectableYears();
  readonly quarters = [1, 2, 3, 4];

  readonly agentId = signal<string | null>(null);
  readonly type = signal<AgcPeriodType>('monthly');
  readonly month = signal(currentMonth());
  readonly year = signal(new Date().getFullYear());
  readonly quarter = signal(currentQuarter());
  readonly from = signal('');
  readonly to = signal('');
  readonly error = signal<AgcOutcome | null>(null);

  readonly payload = computed(() =>
    generatePayloadOf(this.agentId(), {
      type: this.type(),
      month: this.month(),
      year: this.year(),
      quarter: this.quarter(),
      from: this.from(),
      to: this.to(),
    }),
  );

  readonly summary = computed(() => {
    const preview = this.store.preview();
    return preview ? summaryOfPreview(preview) : null;
  });

  /** A statement is generated once the preview of the agent and period came back without a refusal. */
  readonly canGenerate = computed(
    () => this.payload() !== null && this.store.preview() !== null && !this.store.previewing(),
  );

  constructor() {
    // The preview follows the agent and the period while the dialog is open.
    effect(() => {
      const open = this.visible();
      const payload = this.payload();
      untracked(() => {
        if (open && payload !== null) {
          void this.store.previewFor(payload);
        } else {
          this.store.clearPreview();
        }
      });
    });

    // Every time the dialog opens it starts empty.
    effect(() => {
      if (this.visible()) {
        untracked(() => this.error.set(null));
      }
    });
  }

  async generate(): Promise<void> {
    const payload = this.payload();
    if (payload === null || !this.canGenerate()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.generate(payload);
    if (outcome.ok && outcome.statement) {
      this.message.success(this.translate.instant('agentCommissions.message.generated'));
      this.generated.emit(outcome.statement.id);
    } else {
      this.error.set(outcome);
    }
  }
}
