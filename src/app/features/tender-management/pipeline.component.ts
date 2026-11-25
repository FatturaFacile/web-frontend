import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TND_JURISDICTIONS,
  TranslateService,
  TndJurisdiction,
  TndNoticePayload,
  TndParticipation,
  TndParticipationStatus,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { DeadlineCountdownComponent } from './deadline-countdown.component';
import { NoticeFormComponent } from './notice-form.component';
import { PipelineStore } from './pipeline.store';
import {
  jurisdictionBadge,
  jurisdictionColor,
  PIPELINE_COLUMNS,
  severityColor,
  statusColor,
} from './tender-management.util';

type ViewMode = 'kanban' | 'list';

/**
 * Tender pipeline (Mod 169): the dossiers from Scouting to the award or the appeal, as a kanban or a list, with the
 * jurisdiction badges, the live countdown to the peremptory deadline, the quick filters, the dashboard strip and the alerts.
 */
@Component({
  selector: 'app-tnd-pipeline',
  imports: [
    DeadlineCountdownComponent,
    FormsModule,
    MoneyPipe,
    NoticeFormComponent,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSegmentedModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [PipelineStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.TENDER_MANAGEMENT_PIPELINE' | translate"></app-page-header>

    <section class="kpis" [attr.aria-label]="'tenderManagement.kpi.title' | translate">
      <nz-statistic
        [nzTitle]="'tenderManagement.kpi.open' | translate"
        [nzValue]="openCount()"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'tenderManagement.kpi.submittedValue' | translate"
        [nzValue]="(store.dashboard()?.submitted_value ?? 0) | money"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'tenderManagement.kpi.wonValue' | translate"
        [nzValue]="(store.dashboard()?.won_value ?? 0) | money"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'tenderManagement.kpi.vaultExpiring' | translate"
        [nzValue]="(store.dashboard()?.vault?.expiring_soon ?? 0) + (store.dashboard()?.vault?.expired ?? 0)"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'tenderManagement.kpi.openAlerts' | translate"
        [nzValue]="store.dashboard()?.open_alerts ?? 0"
      ></nz-statistic>
    </section>

    @if (store.alerts().length > 0) {
      <section class="alerts" [attr.aria-label]="'tenderManagement.alerts.title' | translate">
        <h2>{{ 'tenderManagement.alerts.title' | translate }}</h2>
        @for (alert of store.alerts(); track alert.id) {
          <nz-alert
            class="alert-row"
            nzShowIcon
            [nzType]="alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'"
            [nzMessage]="alert.message_key | translate: (alert.message_params ?? {})"
            [nzDescription]="'tenderManagement.enum.alertSeverity.' + alert.severity | translate"
            nzCloseable
            (nzOnClose)="store.acknowledge(alert.id)"
          ></nz-alert>
        }
      </section>
    }

    <div class="toolbar">
      <nz-segmented
        [nzOptions]="viewOptions()"
        [ngModel]="view()"
        (ngModelChange)="view.set($event)"
      ></nz-segmented>
      <label class="field" for="tnd-filter-jurisdiction">
        <span>{{ 'tenderManagement.field.jurisdiction' | translate }}</span>
        <nz-select
          nzId="tnd-filter-jurisdiction"
          nzAllowClear
          [nzPlaceHolder]="'tenderManagement.action.all' | translate"
          [ngModel]="store.filters().jurisdiction ?? null"
          (ngModelChange)="store.setFilters({ jurisdiction: $event ?? undefined })"
        >
          @for (value of jurisdictions; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.jurisdiction.' + value | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="tnd-filter-status">
        <span>{{ 'tenderManagement.field.status' | translate }}</span>
        <nz-select
          nzId="tnd-filter-status"
          nzAllowClear
          [nzPlaceHolder]="'tenderManagement.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (value of columns; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.participationStatus.' + value | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="tnd-filter-search">
        <span>{{ 'tenderManagement.field.search' | translate }}</span>
        <input
          nz-input
          id="tnd-filter-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setFilters({ q: search() || undefined })"
        />
      </label>
      <label class="field" for="tnd-filter-deadline">
        <span>{{ 'tenderManagement.filter.deadline' | translate }}</span>
        <nz-select
          nzId="tnd-filter-deadline"
          nzAllowClear
          [nzPlaceHolder]="'tenderManagement.action.all' | translate"
          [ngModel]="store.deadlineWithinHours()"
          (ngModelChange)="store.setDeadlineWithin($event ?? null)"
        >
          <nz-option [nzValue]="24" [nzLabel]="'tenderManagement.filter.within24h' | translate"></nz-option>
          <nz-option [nzValue]="72" [nzLabel]="'tenderManagement.filter.within72h' | translate"></nz-option>
          <nz-option [nzValue]="168" [nzLabel]="'tenderManagement.filter.within7d' | translate"></nz-option>
        </nz-select>
      </label>
      <button nz-button type="button" (click)="store.setFilters({ q: search() || undefined })">
        {{ 'tenderManagement.action.search' | translate }}
      </button>
      <button nz-button nzType="primary" type="button" (click)="openCreate()">
        {{ 'tenderManagement.action.newTender' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (view() === 'kanban') {
        <div class="board">
          @for (status of columns; track status) {
            <section class="column" [attr.aria-label]="'tenderManagement.enum.participationStatus.' + status | translate">
              <h2>
                <nz-tag [nzColor]="color(status)">{{ 'tenderManagement.enum.participationStatus.' + status | translate }}</nz-tag>
                <span class="count">{{ store.columns()[status].length }}</span>
              </h2>
              @for (item of store.columns()[status]; track item.id) {
                <article class="card">
                  <button type="button" class="card-title" (click)="open(item)">
                    {{ item.notice?.title }}
                  </button>
                  <div class="meta">
                    @if (item.notice; as notice) {
                      <nz-tag [nzColor]="jurisdictionColor(notice.jurisdiction)">{{ badge(notice.jurisdiction) }}</nz-tag>
                      <span>{{ notice.contracting_authority_name }}</span>
                      <strong>{{ notice.base_auction_amount | money: notice.currency }}</strong>
                      <app-tnd-countdown [deadline]="notice.submission_peremptory_deadline_at"></app-tnd-countdown>
                    }
                  </div>
                  @if (transitionsOf(item).length > 0) {
                    <nz-select
                      class="move"
                      nzSize="small"
                      [nzPlaceHolder]="'tenderManagement.action.moveTo' | translate"
                      [ngModel]="null"
                      (ngModelChange)="move(item, $event)"
                    >
                      @for (target of transitionsOf(item); track target) {
                        <nz-option [nzValue]="target" [nzLabel]="'tenderManagement.enum.participationStatus.' + target | translate"></nz-option>
                      }
                    </nz-select>
                  }
                </article>
              }
            </section>
          }
        </div>
      } @else {
        <nz-table #table nzSize="small" [nzData]="store.visible()" [nzFrontPagination]="true" [nzPageSize]="25">
          <thead>
            <tr>
              <th scope="col">{{ 'tenderManagement.field.title' | translate }}</th>
              <th scope="col">{{ 'tenderManagement.field.jurisdiction' | translate }}</th>
              <th scope="col">{{ 'tenderManagement.field.contractingAuthority' | translate }}</th>
              <th scope="col" class="num">{{ 'tenderManagement.field.baseAuctionAmount' | translate }}</th>
              <th scope="col">{{ 'tenderManagement.field.submissionDeadline' | translate }}</th>
              <th scope="col">{{ 'tenderManagement.field.status' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (item of table.data; track item.id) {
              <tr>
                <th scope="row">{{ item.notice?.title }}</th>
                <td>
                  @if (item.notice; as notice) {
                    <nz-tag [nzColor]="jurisdictionColor(notice.jurisdiction)">{{ badge(notice.jurisdiction) }}</nz-tag>
                  }
                </td>
                <td>{{ item.notice?.contracting_authority_name }}</td>
                <td class="num">{{ item.notice?.base_auction_amount | money: item.notice?.currency }}</td>
                <td><app-tnd-countdown [deadline]="item.notice?.submission_peremptory_deadline_at"></app-tnd-countdown></td>
                <td>
                  <nz-tag [nzColor]="color(item.status)">{{ 'tenderManagement.enum.participationStatus.' + item.status | translate }}</nz-tag>
                </td>
                <td>
                  <button nz-button nzSize="small" type="button" (click)="open(item)">
                    {{ 'tenderManagement.action.open' | translate }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <nz-empty [nzNotFoundContent]="'tenderManagement.empty.pipeline' | translate"></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="creating()"
      nzWidth="900px"
      [nzTitle]="'tenderManagement.action.newTender' | translate"
      [nzFooter]="null"
      (nzOnCancel)="creating.set(false)"
    >
      <ng-container *nzModalContent>
        @if (createError(); as error) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate: createParams()"></nz-alert>
        }
        <nz-tabs>
          <nz-tab [nzTitle]="'tenderManagement.create.existing' | translate">
            <label class="field" for="tnd-create-notice">
              <span>{{ 'tenderManagement.create.pickNotice' | translate }}</span>
              <nz-select nzId="tnd-create-notice" nzShowSearch [(ngModel)]="pickedNotice">
                @for (notice of store.notices(); track notice.id) {
                  <nz-option [nzValue]="notice.id" [nzLabel]="notice.title"></nz-option>
                }
              </nz-select>
            </label>
            <button nz-button nzType="primary" type="button" [disabled]="!pickedNotice || store.saving()" (click)="createFrom(null, pickedNotice)">
              {{ 'tenderManagement.action.createDossier' | translate }}
            </button>
          </nz-tab>
          <nz-tab [nzTitle]="'tenderManagement.create.new' | translate">
            <app-tnd-notice-form
              [lookups]="store.lookups()"
              [busy]="store.saving()"
              (saved)="createFrom($event, null)"
            ></app-tnd-notice-form>
          </nz-tab>
          <nz-tab [nzTitle]="'tenderManagement.create.simap' | translate">
            <label class="field" for="tnd-create-simap">
              <span>{{ 'tenderManagement.create.simapPayload' | translate }}</span>
              <textarea nz-input id="tnd-create-simap" rows="8" [(ngModel)]="simapJson"></textarea>
            </label>
            <button nz-button nzType="primary" type="button" [disabled]="!simapJson.trim() || store.saving()" (click)="ingest()">
              {{ 'tenderManagement.action.ingestSimap' | translate }}
            </button>
          </nz-tab>
        </nz-tabs>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      margin-bottom: 16px;
    }
    .alerts {
      margin-bottom: 16px;
    }
    .alert-row {
      margin-bottom: 6px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      min-width: 160px;
      gap: 4px;
    }
    .feedback {
      margin-bottom: 12px;
    }
    .board {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(250px, 1fr);
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    .column {
      background: rgba(127, 127, 127, 0.08);
      border-radius: 8px;
      padding: 8px;
      min-height: 160px;
    }
    .column h2 {
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card {
      background: var(--ant-component-background, #fff);
      border: 1px solid rgba(127, 127, 127, 0.25);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
      display: grid;
      gap: 6px;
    }
    .card-title {
      all: unset;
      cursor: pointer;
      font-weight: 600;
      text-decoration: underline;
    }
    .card-title:focus-visible {
      outline: 2px solid currentColor;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      font-size: 12px;
    }
    .num {
      text-align: right;
    }
  `,
})
export class PipelineComponent implements OnInit {
  protected readonly store = inject(PipelineStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly columns: readonly TndParticipationStatus[] = PIPELINE_COLUMNS;
  protected readonly jurisdictions: readonly TndJurisdiction[] = TND_JURISDICTIONS;
  protected readonly view = signal<ViewMode>('kanban');
  protected readonly search = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createParams = signal<Record<string, string | number>>({});
  protected pickedNotice: string | null = null;
  protected simapJson = '';

  protected readonly viewOptions = computed(() => [
    { label: this.i18nLabel('kanban'), value: 'kanban' as const },
    { label: this.i18nLabel('list'), value: 'list' as const },
  ]);

  protected readonly openCount = computed(() => {
    const counts = this.store.dashboard()?.pipeline_counts ?? {};
    return ['Scouting', 'GoApproved', 'PreparingEnvelopes', 'Submitted'].reduce(
      (sum, status) => sum + (counts[status] ?? 0),
      0,
    );
  });

  protected readonly color = statusColor;
  protected readonly jurisdictionColor = jurisdictionColor;
  protected readonly badge = jurisdictionBadge;
  protected readonly severityColor = severityColor;

  ngOnInit(): void {
    void this.store.init();
  }

  /** The segmented control takes plain labels: they are resolved here from the backend dictionary. */
  private i18nLabel(kind: ViewMode): string {
    return this.i18n.instant(`tenderManagement.view.${kind}`);
  }

  protected transitionsOf(item: TndParticipation): TndParticipationStatus[] {
    return this.store.lookups()?.transitions[item.status] ?? [];
  }

  protected open(item: TndParticipation): void {
    void this.router.navigate(['/tender-management/participations', item.id]);
  }

  protected openCreate(): void {
    this.createError.set(null);
    this.pickedNotice = null;
    this.creating.set(true);
  }

  protected async move(item: TndParticipation, status: TndParticipationStatus | null): Promise<void> {
    if (!status) {
      return;
    }
    const outcome = await this.store.transition(item.id, status);
    if (!outcome.ok && outcome.errorKey) {
      this.message.error(this.i18n.instant(outcome.errorKey, outcome.errorParams));
    }
  }

  protected async createFrom(payload: TndNoticePayload | null, noticeId: string | null): Promise<void> {
    const outcome = await this.store.createDossier(payload, noticeId);
    if (!outcome.ok) {
      this.createError.set(outcome.errorKey);
      this.createParams.set(outcome.errorParams);
      return;
    }
    this.creating.set(false);
    const created = this.store.created();
    if (created) {
      this.open(created);
    }
  }

  protected async ingest(): Promise<void> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(this.simapJson) as Record<string, unknown>;
    } catch {
      this.createError.set('tenderManagement.error.simap_payload_invalid');
      return;
    }
    const outcome = await this.store.ingestSimap(payload);
    if (!outcome.ok) {
      this.createError.set(outcome.errorKey);
      return;
    }
    this.createError.set(null);
    this.simapJson = '';
    this.message.success(this.i18n.instant('tenderManagement.message.ingested'));
  }
}
