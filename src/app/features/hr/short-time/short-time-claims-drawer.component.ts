import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import {
  AuthStore,
  I18nService,
  ShortTimeApiService,
  ShortTimeCaseRecord,
  ShortTimeClaim,
  ShortTimeClaimSummary,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable, tap } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

/** The claims of a case and the steps of one claim: send to the fund, carry into payroll, record the reimbursement, export. */
@Component({
  selector: 'app-short-time-claims-drawer',
  imports: [
    ActionFormComponent,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzWidth="720"
      [nzTitle]="'hrmShortTime.claims.title' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <nz-table #table [nzData]="claims()" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmShortTime.claims.period' | translate }}</th>
              <th>{{ 'hrmCommon.statusCol' | translate }}</th>
              <th>{{ 'hrmShortTime.claims.total' | translate }}</th>
              <th>{{ 'hrmCommon.actions' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of table.data; track item.id) {
              <tr>
                <td>{{ item.month }}/{{ item.year }}</td>
                <td>
                  <nz-tag>{{ 'hrmShortTime.claimStatus.' + item.status | translate }}</nz-tag>
                </td>
                <td>{{ item.total_compensation | money: currency() }}</td>
                <td>
                  <button nz-button nzSize="small" type="button" (click)="select(item.id)">
                    {{ 'hrmCommon.view' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        @if (claim(); as c) {
          <h4 class="mt-4">{{ 'hrmShortTime.claims.detail' | translate }}</h4>
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'hrmCommon.statusCol' | translate">
              {{ 'hrmShortTime.claimStatus.' + c.status | translate }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmShortTime.claims.lossPercent' | translate"
              >{{ c.loss_percent }} %</nz-descriptions-item
            >
            <nz-descriptions-item [nzTitle]="'hrmShortTime.claims.minimumLoss' | translate">
              {{ (c.meets_minimum_loss ? 'hrmCommon.yes' : 'hrmCommon.no') | translate }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmShortTime.claims.total' | translate">
              <strong>{{ c.total_compensation | money: currency() }}</strong>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmShortTime.claims.dueOn' | translate">{{
              c.claim_due_on
            }}</nz-descriptions-item>
          </nz-descriptions>
          @for (warning of c.warnings; track $index) {
            <nz-alert class="mt-2" nzType="warning" nzShowIcon [nzMessage]="warning" />
          }
          <div class="flex gap-2 mt-3 flex-wrap">
            @if (canWrite() && c.status === 'draft') {
              <button
                nz-button
                nzType="primary"
                type="button"
                (click)="run(api.submitClaim(c.id), 'hrmShortTime.claims.submitted')"
              >
                {{ 'hrmShortTime.claims.submit' | translate }}
              </button>
            }
            @if (canWrite() && c.status !== 'reimbursed') {
              <button
                nz-button
                type="button"
                (click)="run(api.applyClaim(c.id), 'hrmShortTime.claims.applied')"
              >
                {{ 'hrmShortTime.claims.apply' | translate }}
              </button>
            }
            <button nz-button type="button" (click)="exportCsv(c)">
              {{ 'hrmShortTime.claims.export' | translate }}
            </button>
          </div>
          @if (canWrite() && c.status === 'submitted') {
            <h4 class="mt-4">{{ 'hrmShortTime.claims.reimbursement' | translate }}</h4>
            <app-action-form [config]="reimbursementConfig()" />
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class ShortTimeClaimsDrawerComponent {
  readonly open = model(false);
  readonly caseRecord = input<ShortTimeCaseRecord | null>(null);
  readonly canWrite = input(false);
  /** A claim just calculated: the drawer shows it. */
  readonly focusClaim = input<ShortTimeClaim | null>(null);

  protected readonly api = inject(ShortTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);

  protected readonly claim = signal<ShortTimeClaim | null>(null);
  protected readonly claims = computed<ShortTimeClaimSummary[]>(
    () => this.caseRecord()?.claims ?? [],
  );
  protected readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');

  constructor() {
    effect(() => {
      const focus = this.focusClaim();
      untracked(() => this.claim.set(focus));
    });
  }

  protected select(id: string): void {
    this.api.getClaim(id).subscribe({
      next: (res) => this.claim.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected run(request: Observable<{ data: ShortTimeClaim }>, successKey: string): void {
    request.subscribe({
      next: (res) => {
        this.claim.set(res.data);
        this.message.success(this.i18n.translate(successKey));
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected exportCsv(claim: ShortTimeClaim): void {
    this.api.downloadClaim(claim.id).subscribe({
      next: (blob) => saveBlob(blob, `short-time-claim-${claim.id}.csv`),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected readonly reimbursementConfig = computed<ActionFormConfig>(() => {
    const claimId = this.claim()?.id ?? '';
    return {
      submitLabelKey: 'hrmShortTime.claims.recordReimbursement',
      fields: [
        { key: 'amount', labelKey: 'hrmShortTime.claims.amount', type: 'decimal', required: true },
        { key: 'paid_on', labelKey: 'hrmShortTime.claims.paidOn', type: 'date', nullable: true },
      ],
      submit: (payload) =>
        this.api
          .recordReimbursement(claimId, {
            amount: payload['amount'] as unknown as number,
            paid_on: (payload['paid_on'] as string | null | undefined) ?? null,
          })
          .pipe(tap((res) => this.claim.set(res.data))),
    };
  });
}
