import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { I18nService, PublicRmaApiService, PublicTracking, PublicTrackingStep } from '@core';
import { TranslatePipe } from '@shared';
import { runRequest } from '../state/action-result';
import { rmaStatusLabelKey } from '../utils/rma-status';
import { PublicShellComponent } from './public-shell.component';

type PageState = 'loading' | 'ready' | 'invalid' | 'error';

/** Customer RMA tracking page: `/rma-tracking?rma=<number>&token=<tracking token>` (no session). */
@Component({
  selector: 'app-rma-tracking',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    NzStepsModule,
    TranslatePipe,
    PublicShellComponent,
  ],
  template: `
    <app-rma-public-shell>
      <h1 class="public-title">{{ 'RMA.PUBLIC.TRACKING_TITLE' | translate }}</h1>
      @switch (state()) {
        @case ('loading') {
          <nz-spin nzSimple class="public-spin" [nzTip]="'COMMON.LOADING' | translate" />
        }
        @case ('invalid') {
          <nz-card>
            <p class="public-neutral-title">
              <i class="fa-solid fa-link-slash" aria-hidden="true"></i>
              {{ 'RMA.PUBLIC.INVALID_LINK' | translate }}
            </p>
            <p>{{ 'RMA.PUBLIC.INVALID_LINK_HINT' | translate }}</p>
          </nz-card>
        }
        @case ('error') {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'RMA.PUBLIC.UNAVAILABLE' | translate" />
        }
        @case ('ready') {
          @if (tracking(); as t) {
            <nz-card>
              <dl class="public-fields">
                <dt>{{ 'RMA.FIELDS.RMA_NUMBER' | translate }}</dt>
                <dd>{{ t.rma_number }}</dd>
                <dt>{{ 'COMMON.STATUS' | translate }}</dt>
                <dd>
                  <strong>{{ statusLabel(t.status, t.status_label) }}</strong>
                </dd>
                <dt>{{ 'RMA.PUBLIC.LAST_UPDATE' | translate }}</dt>
                <dd>{{ t.updated_at | date: 'medium' }}</dd>
              </dl>

              @if (t.estimate_pending && t.estimate_url) {
                <nz-alert
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="'RMA.PUBLIC.ESTIMATE_PENDING' | translate"
                  [nzAction]="reviewAction"
                />
                <ng-template #reviewAction>
                  <a nz-button nzType="primary" nzSize="small" [href]="t.estimate_url">{{
                    'RMA.PUBLIC.REVIEW_ESTIMATE' | translate
                  }}</a>
                </ng-template>
              }

              <nz-steps
                class="public-steps"
                nzDirection="vertical"
                nzSize="small"
                [nzCurrent]="currentIndex()"
              >
                @for (step of t.steps; track step.status) {
                  <nz-step
                    [nzTitle]="statusLabel(step.status, step.label)"
                    [nzDescription]="
                      step.reached_at ? ((step.reached_at | date: 'medium') ?? '') : ''
                    "
                    [nzStatus]="stepStatus(step)"
                  />
                }
              </nz-steps>
            </nz-card>
          }
        }
      }
    </app-rma-public-shell>
  `,
  styleUrl: './public-page.scss',
})
export class RmaTrackingComponent implements OnInit {
  private readonly api = inject(PublicRmaApiService);
  private readonly i18n = inject(I18nService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly state = signal<PageState>('loading');
  readonly tracking = signal<PublicTracking | null>(null);

  readonly currentIndex = computed(() => {
    const steps = this.tracking()?.steps ?? [];
    const index = steps.findIndex((s) => s.current);
    return index >= 0 ? index : 0;
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const rma = this.params.get('rma');
    const token = this.params.get('token');
    if (!rma || !token) {
      this.state.set('invalid');
      return;
    }
    const res = await runRequest(this.api.getTracking(rma, token));
    if (res.ok) {
      this.tracking.set(res.data.data);
      this.state.set('ready');
      return;
    }
    this.state.set(
      res.status !== null && res.status >= 400 && res.status < 500 ? 'invalid' : 'error',
    );
  }

  /** Translated status label, falling back to the server label for statuses unknown to the client. */
  statusLabel(status: string, serverLabel: string): string {
    const key = rmaStatusLabelKey(status);
    const translated = this.i18n.translate(key);
    return translated === key ? serverLabel || status : translated;
  }

  stepStatus(step: PublicTrackingStep): 'wait' | 'process' | 'finish' {
    if (step.current) {
      return 'process';
    }
    return step.reached_at ? 'finish' : 'wait';
  }
}
