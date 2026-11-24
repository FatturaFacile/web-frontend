import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { I18nService, Lead, LeadApiService, LeadScorePreview, leadDisplayName } from '@core';
import { apiErrorMessage } from '../leads/lead-http.utils';
import { LeadRatingTagComponent } from '../leads/lead-rating-tag.component';
import { LeadScoreBadgeComponent } from '../leads/lead-score-badge.component';

/** Server-side score preview for a selected lead with the current rules and thresholds. */
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-lead-score-preview',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSelectModule,
    TranslatePipe,
    LeadRatingTagComponent,
    LeadScoreBadgeComponent,
  ],
  template: `
    <nz-card [nzTitle]="'CRM.LEAD_SCORING.PREVIEW.TITLE' | translate">
      <div class="row">
        <nz-select
          class="picker"
          nzShowSearch
          nzAllowClear
          [nzPlaceHolder]="'CRM.LEAD_SCORING.PREVIEW.PICK_LEAD' | translate"
          [attr.aria-label]="'CRM.LEAD_SCORING.PREVIEW.PICK_LEAD' | translate"
          [nzOptions]="leadOptions()"
          [ngModel]="leadId()"
          (ngModelChange)="leadId.set($event)"
        />
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!leadId() || loading()"
          [nzLoading]="loading()"
          (click)="run()"
        >
          {{ 'CRM.LEAD_SCORING.PREVIEW.RUN' | translate }}
        </button>
      </div>

      @if (error()) {
        <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="error()!" />
      }

      @if (result(); as r) {
        <div class="gap" aria-live="polite">
          <div class="row">
            <app-lead-score-badge [score]="r.score" [rating]="r.rating" />
            <app-lead-rating-tag [rating]="r.rating" />
          </div>
          <ul class="breakdown">
            @for (b of r.breakdown; track $index) {
              <li>
                <code>{{ b.code }}</code>
                <span [class.neg]="b.points < 0">{{ b.points > 0 ? '+' : '' }}{{ b.points }}</span>
              </li>
            } @empty {
              <li>{{ 'CRM.LEADS.DETAIL.NO_BREAKDOWN' | translate }}</li>
            }
          </ul>
        </div>
      }
    </nz-card>
  `,
  styles: `
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .picker {
      min-width: 240px;
      flex: 1;
    }
    .gap {
      margin-top: 16px;
    }
    .breakdown {
      list-style: none;
      padding: 0;
      margin: 12px 0 0;
    }
    .breakdown li {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .neg {
      color: #a8071a;
    }
  `,
})
export class LeadScorePreviewComponent {
  private readonly api = inject(LeadApiService);
  private readonly i18n = inject(I18nService);

  readonly leads = signal<Lead[]>([]);
  readonly leadId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly result = signal<LeadScorePreview | null>(null);
  readonly error = signal<string | null>(null);

  protected readonly leadOptions = computed(() =>
    this.leads().map((l) => ({
      value: l.id,
      label: `${leadDisplayName(l)}${l.company_name ? ' - ' + l.company_name : ''}`,
    })),
  );

  constructor() {
    this.api.listLeads({ per_page: 100, sort: '-score' }).subscribe({
      next: (r) => this.leads.set(r.data),
      error: () => this.leads.set([]),
    });
  }

  run(): void {
    const id = this.leadId();
    if (!id || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.previewScore({ lead_id: id }).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.result.set({ ...r, breakdown: r.breakdown ?? [] });
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.result.set(null);
        this.error.set(
          apiErrorMessage(err) ?? this.i18n.translate('CRM.LEAD_SCORING.PREVIEW.FAILED'),
        );
      },
    });
  }
}
