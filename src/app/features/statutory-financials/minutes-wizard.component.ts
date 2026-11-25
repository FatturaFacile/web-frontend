import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { SfDossier, SfNarrativeTemplate, SfPdfaPayload } from '@core';
import { TranslatePipe } from '@shared';
import {
  buildMinutesPayload,
  emptyMinutesDraft,
  formatAmount,
  jurisdictionOf,
  MinutesDraft,
  minutesProblem,
  scaleOfMode,
  SfOutcome,
} from './statutory-financials.util';

/**
 * The minutes generator: choose the board and/or shareholders minutes, enter the meeting, review the profit allocation
 * the API puts in the minutes, then ask for the PDF/A documents with the meeting data.
 */
@Component({
  selector: 'app-sf-minutes-wizard',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzStepsModule,
    TranslatePipe,
  ],
  styleUrl: './statutory-financials.scss',
  template: `
    <nz-modal
      [nzVisible]="open()"
      nzWidth="720px"
      [nzTitle]="'statutoryFinancials.minutes.title' | translate"
      [nzFooter]="null"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        <nz-steps class="steps-bar" nzSize="small" [nzCurrent]="step()">
          @for (name of stepNames; track name) {
            <nz-step [nzTitle]="'statutoryFinancials.minutes.step.' + name | translate"></nz-step>
          }
        </nz-steps>

        @if (error(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'statutoryFinancials.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail"
          ></nz-alert>
        }
        @if (problem(); as key) {
          <nz-alert
            class="feedback"
            nzType="warning"
            nzShowIcon
            role="alert"
            [nzMessage]="'statutoryFinancials.minutes.problem.' + key | translate"
          ></nz-alert>
        }

        @switch (step()) {
          @case (0) {
            <div
              class="form-grid"
              role="group"
              [attr.aria-label]="'statutoryFinancials.minutes.step.kind' | translate"
            >
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label
                nz-checkbox
                [ngModel]="draft().board"
                (ngModelChange)="patch({ board: $event })"
              >
                {{ 'statutoryFinancials.pdfaKind.board_minutes' | translate }}
              </label>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label
                nz-checkbox
                [ngModel]="draft().shareholders"
                (ngModelChange)="patch({ shareholders: $event })"
              >
                {{ 'statutoryFinancials.pdfaKind.shareholders_minutes' | translate }}
              </label>
            </div>
          }
          @case (1) {
            <div class="form-grid">
              <label class="field" for="sf-meeting-date">
                <span>{{ 'statutoryFinancials.minutes.meetingDate' | translate }} *</span>
                <nz-date-picker
                  nzId="sf-meeting-date"
                  nzFormat="yyyy-MM-dd"
                  [ngModel]="draft().meeting_date"
                  (ngModelChange)="patch({ meeting_date: $event })"
                ></nz-date-picker>
              </label>
              <label class="field" for="sf-meeting-place">
                <span>{{ 'statutoryFinancials.minutes.meetingPlace' | translate }}</span>
                <input
                  nz-input
                  id="sf-meeting-place"
                  maxlength="120"
                  [ngModel]="draft().meeting_place"
                  (ngModelChange)="patch({ meeting_place: $event })"
                />
              </label>
              <label class="field" for="sf-meeting-chair">
                <span>{{ 'statutoryFinancials.minutes.chair' | translate }}</span>
                <input
                  nz-input
                  id="sf-meeting-chair"
                  maxlength="120"
                  [ngModel]="draft().chair"
                  (ngModelChange)="patch({ chair: $event })"
                />
              </label>
              <label class="field" for="sf-meeting-secretary">
                <span>{{ 'statutoryFinancials.minutes.secretary' | translate }}</span>
                <input
                  nz-input
                  id="sf-meeting-secretary"
                  maxlength="120"
                  [ngModel]="draft().secretary"
                  (ngModelChange)="patch({ secretary: $event })"
                />
              </label>
              <label class="field field-wide" for="sf-meeting-attendees">
                <span>{{ 'statutoryFinancials.minutes.attendees' | translate }}</span>
                <nz-select
                  nzId="sf-meeting-attendees"
                  nzMode="tags"
                  [nzTokenSeparators]="[',', ';']"
                  [nzPlaceHolder]="'statutoryFinancials.minutes.attendeesHint' | translate"
                  [ngModel]="draft().attendees"
                  (ngModelChange)="patch({ attendees: $event })"
                ></nz-select>
              </label>
            </div>
          }
          @case (2) {
            <p class="muted">{{ 'statutoryFinancials.minutes.reviewHint' | translate }}</p>
            @if (dossier()?.profit_allocation_proposal; as p) {
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2 }">
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.allocation.netProfit' | translate"
                  >{{ amount(p.net_profit) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.allocation.legalReserveAllocation' | translate"
                  >{{ amount(p.legal_reserve_allocation) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.allocation.dividends' | translate"
                  >{{ amount(p.dividends) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.allocation.otherReserves' | translate"
                  >{{ amount(p.other_reserves) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.allocation.carriedForwardOut' | translate"
                  >{{ amount(p.carried_forward_out) }}</nz-descriptions-item
                >
              </nz-descriptions>
              @for (warning of p.warnings; track warning) {
                <nz-alert
                  class="feedback"
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="warning"
                ></nz-alert>
              }
            } @else {
              <nz-alert
                class="feedback"
                nzType="info"
                nzShowIcon
                [nzMessage]="'statutoryFinancials.minutes.noAllocation' | translate"
              ></nz-alert>
            }
            @for (template of allocationTemplates(); track template.key) {
              <h4 class="section-title">{{ template.title }}</h4>
              <p>{{ template.body }}</p>
            }
          }
        }

        <div class="actions">
          @if (step() > 0) {
            <button nz-button type="button" (click)="previous()">
              {{ 'statutoryFinancials.action.previous' | translate }}
            </button>
          }
          @if (step() < 2) {
            <button nz-button nzType="primary" type="button" (click)="next()">
              {{ 'statutoryFinancials.action.next' | translate }}
            </button>
          } @else {
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="generating()"
              [nzLoading]="generating()"
              (click)="submit()"
            >
              {{ 'statutoryFinancials.action.generateMinutes' | translate }}
            </button>
          }
          <button nz-button type="button" (click)="close()">
            {{ 'statutoryFinancials.action.cancel' | translate }}
          </button>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class MinutesWizardComponent {
  readonly open = input<boolean>(false);
  readonly dossier = input<SfDossier | null>(null);
  readonly templates = input<readonly SfNarrativeTemplate[]>([]);
  readonly generating = input<boolean>(false);
  readonly error = input<SfOutcome | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<SfPdfaPayload>();

  protected readonly stepNames = ['kind', 'meeting', 'review'] as const;
  protected readonly step = signal(0);
  protected readonly draft = signal<MinutesDraft>(emptyMinutesDraft());
  protected readonly problem = signal<'kind_required' | 'date_required' | null>(null);

  /** The templates of the profit allocation text, as the API worded them. */
  protected readonly allocationTemplates = computed(() =>
    this.templates().filter((template) => template.key.includes('profit_allocation')),
  );

  protected patch(patch: Partial<MinutesDraft>): void {
    this.problem.set(null);
    this.draft.update((draft) => ({ ...draft, ...patch }));
  }

  protected amount(value: string | null | undefined): string {
    const dossier = this.dossier();
    return formatAmount(
      value,
      jurisdictionOf(dossier?.accounting_standard),
      scaleOfMode(dossier?.rounding_to_unit_mode),
    );
  }

  protected previous(): void {
    this.problem.set(null);
    this.step.update((step) => Math.max(0, step - 1));
  }

  protected next(): void {
    const problem = minutesProblem(this.step(), this.draft());
    this.problem.set(problem);
    if (problem === null) {
      this.step.update((step) => step + 1);
    }
  }

  protected submit(): void {
    this.submitted.emit(buildMinutesPayload(this.draft()));
  }

  protected close(): void {
    this.step.set(0);
    this.problem.set(null);
    this.closed.emit();
  }
}
