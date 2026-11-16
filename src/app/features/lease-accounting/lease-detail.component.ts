import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  LeaseAccountingApiService,
  LeaseContract,
  LeaseMeasurementPreview,
  LeaseScheduleLine,
  LeaseScheduleVersion,
  LeaseStatus,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { LeaseFormComponent } from './lease-form.component';
import { LeaseRemeasureComponent } from './lease-remeasure.component';
import { LeaseScheduleTableComponent } from './lease-schedule-table.component';

const STATUS_COLORS: Record<LeaseStatus, string> = { draft: 'default', active: 'green', expired: 'blue', cancelled: 'red' };

/**
 * One lease: terms, the schedule in force with the version history, and the actions the status allows: preview and
 * activate a draft, remeasure and post the periods of an active lease.
 */
@Component({
  selector: 'app-lease-detail',
  imports: [
    FormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    MoneyPipe,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeaseFormComponent,
    LeaseRemeasureComponent,
    LeaseScheduleTableComponent,
  ],
  template: `
    @if (lease(); as l) {
      <app-page-header [title]="l.number + ' - ' + l.title" [subtitle]="l.lessor_name">
        <a nz-button routerLink="/leases">{{ 'LEASES.BACK' | translate }}</a>
      </app-page-header>

      <nz-card>
        <div class="toolbar">
          <nz-tag [nzColor]="statusColor(l.status)">{{ 'LEASES.STATUS_' + l.status | translate }}</nz-tag>
          <nz-tag>{{ 'LEASES.STANDARD_' + l.accounting_standard | translate }}</nz-tag>
          @if (l.exemption !== 'none') {
            <nz-tag>{{ 'LEASES.EXEMPTION_' + l.exemption | translate }}</nz-tag>
          }
          <span class="spacer"></span>
          @if (canWrite()) {
            @if (l.status === 'draft') {
              @if (l.exemption === 'none') {
                <button nz-button type="button" (click)="openPreview()">{{ 'LEASES.PREVIEW' | translate }}</button>
              }
              <button nz-button type="button" appIconAction="edit" (click)="formVisible.set(true)"></button>
              <button nz-button nzType="primary" type="button" (click)="activateVisible.set(true)">{{ 'LEASES.ACTIVATE' | translate }}</button>
              <button nz-button nzDanger type="button" (click)="cancelVisible.set(true)">{{ 'LEASES.CANCEL_LEASE' | translate }}</button>
              <button
                nz-button
                nzDanger
                type="button"
                appIconAction="delete"
                nz-popconfirm
                [nzPopconfirmTitle]="'LEASES.DELETE_CONFIRM' | translate"
                (nzOnConfirm)="remove()"
              ></button>
            }
            @if (l.status === 'active' && l.exemption === 'none') {
              <button nz-button type="button" (click)="remeasureVisible.set(true)">{{ 'LEASES.REMEASURE' | translate }}</button>
              <button nz-button nzType="primary" type="button" (click)="postVisible.set(true)">{{ 'LEASES.POST_PERIODS' | translate }}</button>
            }
          }
        </div>

        @if (l.exemption !== 'none') {
          <p class="notice">{{ 'LEASES.EXEMPT_NOTICE' | translate }}</p>
        }

        @if (currentVersion(); as v) {
          <div class="stats">
            <nz-statistic [nzTitle]="'LEASES.LIABILITY_OUTSTANDING' | translate" [nzValue]="(outstandingLiability() | money: l.currency)"></nz-statistic>
            <nz-statistic [nzTitle]="'LEASES.ROU_CARRYING' | translate" [nzValue]="(outstandingRou() | money: l.currency)"></nz-statistic>
            <nz-statistic [nzTitle]="'LEASES.TOTAL_UNDISCOUNTED' | translate" [nzValue]="(v.total_undiscounted | money: l.currency)"></nz-statistic>
            <nz-statistic [nzTitle]="'LEASES.FIELD.new_discount_rate_percent' | translate" [nzValue]="v.discount_rate_percent + ' %'"></nz-statistic>
            <nz-statistic [nzTitle]="'LEASES.CURRENT_VERSION' | translate" [nzValue]="v.version_number"></nz-statistic>
          </div>
        }

        <nz-tabs>
          @if (l.exemption === 'none') {
            <nz-tab [nzTitle]="'LEASES.TAB_SCHEDULE' | translate">
              @if (versions().length > 1) {
                <nz-select class="version-select" [ngModel]="scheduleVersion()" (ngModelChange)="loadSchedule($event)" [attr.aria-label]="'LEASES.SCHEDULE_VERSION' | translate">
                  <nz-option [nzValue]="null" [nzLabel]="'LEASES.SCHEDULE_IN_FORCE' | translate"></nz-option>
                  @for (v of versions(); track v.id) {
                    <nz-option [nzValue]="v.version_number" [nzLabel]="'LEASES.VERSION_N' | translate: { number: v.version_number }"></nz-option>
                  }
                </nz-select>
              }
              @if (schedule().length > 0) {
                <app-lease-schedule-table [lines]="schedule()" [currency]="l.currency" [exportFileName]="'lease-' + l.number" />
              } @else {
                <nz-empty [nzNotFoundContent]="'LEASES.NO_SCHEDULE' | translate"></nz-empty>
              }
            </nz-tab>
            <nz-tab [nzTitle]="'LEASES.TAB_VERSIONS' | translate">
              <nz-table #versionsTable [nzData]="versions()" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
                <thead>
                  <tr>
                    <th scope="col">{{ 'LEASES.COL_VERSION' | translate }}</th>
                    <th scope="col">{{ 'LEASES.FIELD.reason' | translate }}</th>
                    <th scope="col">{{ 'LEASES.FIELD.effective_date' | translate }}</th>
                    <th scope="col">{{ 'LEASES.COL_LIABILITY_BEFORE' | translate }}</th>
                    <th scope="col">{{ 'LEASES.COL_LIABILITY_AFTER' | translate }}</th>
                    <th scope="col">{{ 'LEASES.COL_LIABILITY_ADJUSTMENT' | translate }}</th>
                    <th scope="col">{{ 'LEASES.COL_ROU_ADJUSTMENT' | translate }}</th>
                    <th scope="col">{{ 'LEASES.COL_RESULT' | translate }}</th>
                    <th scope="col">{{ 'LEASES.COL_STATUS' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of versionsTable.data; track v.id) {
                    <tr>
                      <td>{{ v.version_number }}</td>
                      <td>{{ 'LEASES.REASON_' + v.reason | translate }}</td>
                      <td>{{ v.effective_date }}</td>
                      <td>{{ v.liability_before | money: l.currency }}</td>
                      <td>{{ v.liability_after | money: l.currency }}</td>
                      <td>{{ v.liability_adjustment | money: l.currency }}</td>
                      <td>{{ v.rou_adjustment | money: l.currency }}</td>
                      <td>{{ v.result_amount | money: l.currency }}</td>
                      <td>{{ 'LEASES.VERSION_STATUS_' + v.status | translate }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
          }
          <nz-tab [nzTitle]="'LEASES.TAB_TERMS' | translate">
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
              <nz-descriptions-item [nzTitle]="'LEASES.ASSET_CLASS' | translate">{{ 'LEASES.ASSET_CLASS_' + l.asset_class | translate }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.currency' | translate">{{ l.currency }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.commencement_date' | translate">{{ l.commencement_date }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.term_months' | translate">{{ l.term_months }} ({{ l.effective_term_months }})</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.payment_amount' | translate">{{ l.payment_amount | money: l.currency }} / {{ 'LEASES.FREQUENCY_' + l.payment_frequency | translate }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.payment_timing' | translate">{{ 'LEASES.TIMING_' + l.payment_timing | translate }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.escalation_type' | translate">
                {{ 'LEASES.ESCALATION_' + l.escalation_type | translate }}
                @if (l.escalation_type === 'fixed') {
                  ({{ l.escalation_rate_percent }} %)
                }
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.incremental_borrowing_rate_percent' | translate">{{ l.incremental_borrowing_rate_percent }} %</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.initial_direct_costs' | translate">{{ l.initial_direct_costs | money: l.currency }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'LEASES.FIELD.incentives_received' | translate">{{ l.incentives_received | money: l.currency }}</nz-descriptions-item>
              @if (l.purchase_option_reasonably_certain) {
                <nz-descriptions-item [nzTitle]="'LEASES.FIELD.purchase_option_price' | translate">{{ l.purchase_option_price | money: l.currency }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'LEASES.FIELD.useful_life_months' | translate">{{ l.useful_life_months }}</nz-descriptions-item>
              }
              @if (l.extension_reasonably_certain) {
                <nz-descriptions-item [nzTitle]="'LEASES.FIELD.extension_months' | translate">{{ l.extension_months }}</nz-descriptions-item>
              }
              @if (l.asset_description) {
                <nz-descriptions-item [nzTitle]="'LEASES.FIELD.asset_description' | translate" [nzSpan]="2">{{ l.asset_description }}</nz-descriptions-item>
              }
              @if (l.cancellation_reason) {
                <nz-descriptions-item [nzTitle]="'LEASES.CANCEL_REASON' | translate" [nzSpan]="2">{{ l.cancellation_reason }}</nz-descriptions-item>
              }
              @if (l.notes) {
                <nz-descriptions-item [nzTitle]="'LEASES.FIELD.notes' | translate" [nzSpan]="2">{{ l.notes }}</nz-descriptions-item>
              }
            </nz-descriptions>
          </nz-tab>
        </nz-tabs>
      </nz-card>

      <app-lease-form [(visible)]="formVisible" [lease]="l" (saved)="reload()" />
      <app-lease-remeasure [(visible)]="remeasureVisible" [lease]="l" [schedule]="currentSchedule()" (remeasured)="reload()" />

      <nz-modal [(nzVisible)]="previewVisible" [nzTitle]="'LEASES.PREVIEW' | translate" (nzOnCancel)="previewVisible.set(false)" [nzFooter]="null" nzWidth="1100px">
        <ng-container *nzModalContent>
          @if (preview(); as p) {
            <p>{{ 'LEASES.PREVIEW_HINT' | translate }}</p>
            <div class="stats">
              <nz-statistic [nzTitle]="'LEASES.LIABILITY_INITIAL' | translate" [nzValue]="(p.lease_liability | money: l.currency)"></nz-statistic>
              <nz-statistic [nzTitle]="'LEASES.ROU_INITIAL' | translate" [nzValue]="(p.rou_asset | money: l.currency)"></nz-statistic>
              <nz-statistic [nzTitle]="'LEASES.TOTAL_UNDISCOUNTED' | translate" [nzValue]="(p.total_undiscounted | money: l.currency)"></nz-statistic>
            </div>
            <app-lease-schedule-table [lines]="p.lines" [currency]="l.currency" exportFileName="lease-preview" />
          }
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="activateVisible" [nzTitle]="'LEASES.ACTIVATE' | translate" (nzOnCancel)="activateVisible.set(false)" (nzOnOk)="activate()" [nzOkLoading]="busy()" okAction="confirm">
        <ng-container *nzModalContent>
          <p>{{ 'LEASES.ACTIVATE_CONFIRM' | translate }}</p>
          @if (l.exemption === 'none') {
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label>
              <nz-switch [(ngModel)]="postRecognition" [attr.aria-label]="'LEASES.FIELD.post_recognition' | translate" />
              {{ 'LEASES.FIELD.post_recognition' | translate }}
            </label>
          }
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="cancelVisible" [nzTitle]="'LEASES.CANCEL_LEASE' | translate" (nzOnCancel)="cancelVisible.set(false)" (nzOnOk)="cancelLease()" [nzOkDisabled]="!cancelReason.trim()" [nzOkLoading]="busy()" okAction="confirm">
        <ng-container *nzModalContent>
          <label for="lease-cancel-reason">{{ 'LEASES.CANCEL_REASON' | translate }}</label>
          <textarea nz-input id="lease-cancel-reason" rows="3" maxlength="2000" [(ngModel)]="cancelReason"></textarea>
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="postVisible" [nzTitle]="'LEASES.POST_PERIODS' | translate" (nzOnCancel)="postVisible.set(false)" (nzOnOk)="postPeriods()" [nzOkDisabled]="!throughDate" [nzOkLoading]="busy()" okAction="confirm">
        <ng-container *nzModalContent>
          <p>{{ 'LEASES.POST_PERIODS_HINT' | translate }}</p>
          <label for="lease-through-date">{{ 'LEASES.FIELD.through_date' | translate }}</label>
          <input nz-input id="lease-through-date" type="date" [(ngModel)]="throughDate" [max]="today" />
        </ng-container>
      </nz-modal>
    } @else if (loading()) {
      <nz-card [nzLoading]="true"></nz-card>
    } @else {
      <nz-empty [nzNotFoundContent]="'LEASES.NOT_FOUND' | translate"></nz-empty>
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }
    .spacer {
      flex: 1;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      margin-bottom: 16px;
    }
    .notice {
      margin-bottom: 16px;
    }
    .version-select {
      min-width: 220px;
      margin-bottom: 12px;
    }
  `,
})
export class LeaseDetailComponent implements OnInit {
  private readonly api = inject(LeaseAccountingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('leases'));
  protected readonly lease = signal<LeaseContract | null>(null);
  protected readonly loading = signal(true);
  protected readonly versions = signal<LeaseScheduleVersion[]>([]);
  protected readonly schedule = signal<LeaseScheduleLine[]>([]);
  /** The schedule in force, kept apart from the version the user is looking at: remeasuring starts from it. */
  protected readonly currentSchedule = signal<LeaseScheduleLine[]>([]);
  protected readonly scheduleVersion = signal<number | null>(null);
  protected readonly preview = signal<LeaseMeasurementPreview | null>(null);
  protected readonly busy = signal(false);
  protected readonly formVisible = signal(false);
  protected readonly remeasureVisible = signal(false);
  protected readonly previewVisible = signal(false);
  protected readonly activateVisible = signal(false);
  protected readonly cancelVisible = signal(false);
  protected readonly postVisible = signal(false);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected postRecognition = true;
  protected cancelReason = '';
  protected throughDate = this.today;

  protected readonly currentVersion = computed(() => this.versions().find((version) => version.status === 'current') ?? null);
  /** Liability and asset still to be depreciated: the opening balances of the first period that is not posted. */
  private readonly nextLine = computed(() => this.currentSchedule().find((line) => line.status === 'scheduled') ?? null);
  protected readonly outstandingLiability = computed(() => this.nextLine()?.opening_liability ?? '0.00');
  protected readonly outstandingRou = computed(() => this.nextLine()?.rou_opening ?? '0.00');

  ngOnInit(): void {
    this.reload();
  }

  protected statusColor(status: LeaseStatus): string {
    return STATUS_COLORS[status];
  }

  protected reload(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getContract(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.lease.set(res.data);
        this.versions.set(res.data.versions ?? []);

        if (res.data.exemption === 'none' && res.data.current_version_number > 0) {
          this.api.getSchedule(id).subscribe((schedule) => {
            this.currentSchedule.set(schedule.data);
            this.schedule.set(schedule.data);
            this.scheduleVersion.set(null);
          });
        } else {
          this.currentSchedule.set([]);
          this.schedule.set([]);
        }
      },
      error: () => {
        this.loading.set(false);
        this.lease.set(null);
      },
    });
  }

  protected loadSchedule(versionNumber: number | null): void {
    const lease = this.lease();
    if (!lease) {
      return;
    }
    this.scheduleVersion.set(versionNumber);
    this.api.getSchedule(lease.id, versionNumber ?? undefined).subscribe((res) => this.schedule.set(res.data));
  }

  protected openPreview(): void {
    const lease = this.lease();
    if (!lease) {
      return;
    }
    this.api.previewContract(lease.id).subscribe({
      next: (res) => {
        this.preview.set(res.data);
        this.previewVisible.set(true);
      },
      error: (err: { error?: { errors?: Record<string, string[]>; message?: string } }) => this.message.error(this.firstError(err)),
    });
  }

  protected activate(): void {
    this.run(this.api.activateContract(this.lease()?.id ?? '', { post_recognition: this.postRecognition }), 'LEASES.MSG_ACTIVATED', this.activateVisible);
  }

  protected cancelLease(): void {
    this.run(this.api.cancelContract(this.lease()?.id ?? '', { reason: this.cancelReason.trim() }), 'LEASES.MSG_CANCELLED', this.cancelVisible);
  }

  protected postPeriods(): void {
    const lease = this.lease();
    if (!lease) {
      return;
    }
    this.busy.set(true);
    this.api.postPeriods(lease.id, this.throughDate).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.postVisible.set(false);
        this.message.success(this.i18n.translate(res.data.length > 0 ? 'LEASES.MSG_POSTED' : 'LEASES.MSG_NOTHING_TO_POST', { count: res.data.length }));
        this.reload();
      },
      error: (err: { error?: { errors?: Record<string, string[]>; message?: string } }) => {
        this.busy.set(false);
        this.message.error(this.firstError(err));
      },
    });
  }

  protected remove(): void {
    const lease = this.lease();
    if (!lease) {
      return;
    }
    this.api.deleteContract(lease.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('LEASES.MSG_DELETED'));
        void this.router.navigate(['/leases']);
      },
      error: (err: { error?: { errors?: Record<string, string[]>; message?: string } }) => this.message.error(this.firstError(err)),
    });
  }

  private run(request: ReturnType<LeaseAccountingApiService['activateContract']>, successKey: string, dialog: { set(value: boolean): void }): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        dialog.set(false);
        this.message.success(this.i18n.translate(successKey));
        this.reload();
      },
      error: (err: { error?: { errors?: Record<string, string[]>; message?: string } }) => {
        this.busy.set(false);
        this.message.error(this.firstError(err));
      },
    });
  }

  private firstError(err: { error?: { errors?: Record<string, string[]>; message?: string } }): string {
    const first = Object.values(err.error?.errors ?? {})[0]?.[0];
    return first ?? err.error?.message ?? this.i18n.translate('LEASES.MSG_ERROR');
  }
}
