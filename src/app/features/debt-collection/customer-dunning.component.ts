import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  DcExclusion,
  DcExclusionPayload,
  DcExclusionType,
  DcNotice,
  DcPaymentPlan,
  DcPaymentPlanPayload,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { CustomerDunningStore } from './customer-dunning.store';
import { DcExclusionDialogComponent } from './dc-exclusion-dialog.component';
import { DcFeedback } from './dc-feedback.service';
import { DcNoteDialogComponent } from './dc-note-dialog.component';
import { DcPlanDialogComponent } from './dc-plan-dialog.component';
import { DcLookupsStore } from './lookups.store';
import {
  DEBT_COLLECTION_MODULE,
  dossierStatusColor,
  levelColor,
  noticeStatusColor,
  planStatusColor,
} from './debt-collection.util';

/**
 * Dunning section of the customer master record: summary of the overdue exposure, the dunning timeline, the notices with
 * their PEC receipts, the interest and fees charged, the Betreibung dossiers, and the controls to flag a dispute or a
 * legal hold and to agree or close a payment plan.
 */
@Component({
  selector: 'app-customer-dunning',
  imports: [
    MoneyPipe,
    TranslatePipe,
    DcExclusionDialogComponent,
    DcNoteDialogComponent,
    DcPlanDialogComponent,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
  ],
  providers: [CustomerDunningStore],
  styleUrl: './debt-collection.scss',
  template: `
    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.history(); as history) {
        <section class="stats" [attr.aria-label]="'debtCollection.customer.summary' | translate">
          <nz-statistic
            [nzTitle]="'debtCollection.customer.openOverdue' | translate"
            [nzValueTemplate]="overdue"
          />
          <ng-template #overdue>
            @for (row of history.summary.open_overdue; track row.currency) {
              <div>{{ row.amount | money: row.currency }}</div>
            } @empty {
              <span class="muted">{{ 'debtCollection.dashboard.none' | translate }}</span>
            }
          </ng-template>
          <nz-statistic
            [nzTitle]="'debtCollection.customer.currentLevel' | translate"
            [nzValueTemplate]="level"
          />
          <ng-template #level>
            @if (history.summary.current_level !== null) {
              <nz-tag [nzColor]="levelTag(history.summary.current_level)">{{
                'debtCollection.level.' + history.summary.current_level | translate
              }}</nz-tag>
            } @else {
              <span class="muted">{{ 'debtCollection.level.none' | translate }}</span>
            }
          </ng-template>
          <nz-statistic
            [nzTitle]="'debtCollection.customer.interestAccrued' | translate"
            [nzValueTemplate]="interest"
          />
          <ng-template #interest>
            @for (row of history.summary.interest_accrued; track row.currency) {
              <div>{{ row.amount | money: row.currency }}</div>
            } @empty {
              <span class="muted">{{ 'debtCollection.dashboard.none' | translate }}</span>
            }
          </ng-template>
          <nz-statistic
            [nzTitle]="'debtCollection.customer.feesCharged' | translate"
            [nzValueTemplate]="fees"
          />
          <ng-template #fees>
            @for (row of history.summary.fees_charged; track row.currency) {
              <div>{{ row.amount | money: row.currency }}</div>
            } @empty {
              <span class="muted">{{ 'debtCollection.dashboard.none' | translate }}</span>
            }
          </ng-template>
          <nz-statistic
            [nzTitle]="'debtCollection.customer.activeExclusions' | translate"
            [nzValue]="history.summary.active_exclusions"
          />
          <nz-statistic
            [nzTitle]="'debtCollection.customer.activePlans' | translate"
            [nzValue]="history.summary.active_plans"
          />
        </section>

        @if (canWrite) {
          <div class="toolbar">
            <button nz-button type="button" (click)="openFlag('dispute')">
              {{ 'debtCollection.action.flagDispute' | translate }}
            </button>
            <button nz-button type="button" (click)="openFlag('legal_hold')">
              {{ 'debtCollection.action.flagLegalHold' | translate }}
            </button>
            <button nz-button type="button" (click)="openPlan()">
              {{ 'debtCollection.action.newPlan' | translate }}
            </button>
          </div>
        }

        <h4 class="section-title">{{ 'debtCollection.customer.timeline' | translate }}</h4>
        @if (history.timeline.length > 0) {
          <nz-timeline>
            @for (event of history.timeline; track event.id) {
              <nz-timeline-item>
                <strong>{{ 'debtCollection.event.' + event.event | translate }}</strong>
                @if (event.level !== null) {
                  <nz-tag [nzColor]="levelTag(event.level)">{{
                    'debtCollection.level.' + event.level | translate
                  }}</nz-tag>
                }
                @if (event.amount !== null && event.currency) {
                  {{ event.amount | money: event.currency }}
                }
                <small class="muted">{{ event.occurred_at }}</small>
              </nz-timeline-item>
            }
          </nz-timeline>
        } @else {
          <nz-empty [nzNotFoundContent]="'debtCollection.customer.noTimeline' | translate" />
        }

        <h4 class="section-title">{{ 'debtCollection.customer.notices' | translate }}</h4>
        <nz-table nzSize="small" [nzData]="history.notices" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'debtCollection.field.number' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.level' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.channel' | translate }}</th>
              <th scope="col" class="num">{{ 'debtCollection.field.interest' | translate }}</th>
              <th scope="col" class="num">{{ 'debtCollection.field.fee' | translate }}</th>
              <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
              <th scope="col">{{ 'debtCollection.notices.receipts' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (notice of history.notices; track notice.id) {
              <tr>
                <th scope="row">{{ notice.number }}</th>
                <td>
                  <nz-tag [nzColor]="levelTag(notice.level)">{{
                    'debtCollection.level.' + notice.level | translate
                  }}</nz-tag>
                </td>
                <td>{{ 'debtCollection.channel.' + notice.channel | translate }}</td>
                <td class="num">{{ notice.interest | money: notice.currency }}</td>
                <td class="num">{{ notice.fee | money: notice.currency }}</td>
                <td class="num">{{ notice.total | money: notice.currency }}</td>
                <td>
                  <nz-tag [nzColor]="noticeTag(notice.status)">{{
                    'debtCollection.noticeStatus.' + notice.status | translate
                  }}</nz-tag>
                </td>
                <td>
                  <div class="inline-tags">
                    @for (receipt of notice.receipts; track receipt.id) {
                      <nz-tag
                        [nzColor]="
                          receipt.kind === 'consegna' || receipt.kind === 'accettazione'
                            ? 'green'
                            : 'red'
                        "
                        >{{ 'debtCollection.receiptKind.' + receipt.kind | translate }}</nz-tag
                      >
                    }
                  </div>
                </td>
                <td>
                  @if (notice.has_pdf) {
                    <button nz-button nzSize="small" type="button" (click)="pdf(notice)">
                      {{ 'debtCollection.action.pdf' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (history.notices.length === 0) {
          <nz-empty [nzNotFoundContent]="'debtCollection.notices.empty' | translate" />
        }

        <h4 class="section-title">{{ 'debtCollection.legal.dossiers' | translate }}</h4>
        <nz-table nzSize="small" [nzData]="history.dossiers" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'debtCollection.field.number' | translate }}</th>
              <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.office' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (dossier of history.dossiers; track dossier.id) {
              <tr>
                <th scope="row">{{ dossier.number }}</th>
                <td class="num">{{ dossier.total | money: dossier.currency }}</td>
                <td>
                  <nz-tag [nzColor]="dossierTag(dossier.status)">{{
                    'debtCollection.dossierStatus.' + dossier.status | translate
                  }}</nz-tag>
                </td>
                <td>{{ dossier.office?.name ?? '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (history.dossiers.length === 0) {
          <nz-empty [nzNotFoundContent]="'debtCollection.legal.noDossiers' | translate" />
        }

        <h4 class="section-title">{{ 'debtCollection.exclusion.title' | translate }}</h4>
        <nz-table nzSize="small" [nzData]="history.exclusions" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'debtCollection.field.exclusionType' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.reason' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.createdAt' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.releasedAt' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of history.exclusions; track row.id) {
              <tr>
                <td>
                  <nz-tag [nzColor]="row.type === 'manual' ? 'default' : 'red'">{{
                    'debtCollection.exclusionType.' + row.type | translate
                  }}</nz-tag>
                </td>
                <td>{{ row.reason }}</td>
                <td>{{ row.created_at }}</td>
                <td>{{ row.released_at ?? '' }}</td>
                <td>
                  @if (canWrite && !row.released_at) {
                    <button nz-button nzSize="small" type="button" (click)="releasing.set(row)">
                      {{ 'debtCollection.action.release' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        <h4 class="section-title">{{ 'debtCollection.plan.title' | translate }}</h4>
        <nz-table nzSize="small" [nzData]="history.plans" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.startDate' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.endDate' | translate }}</th>
              <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (plan of history.plans; track plan.id) {
              <tr>
                <td class="num">{{ plan.total_amount | money: plan.currency }}</td>
                <td>{{ plan.start_date }}</td>
                <td>{{ plan.end_date }}</td>
                <td>
                  <nz-tag [nzColor]="planTag(plan.status)">{{
                    'debtCollection.planStatus.' + plan.status | translate
                  }}</nz-tag>
                </td>
                <td>
                  @if (canWrite && plan.status === 'active') {
                    <div class="row-actions">
                      <button
                        nz-button
                        nzSize="small"
                        nzType="primary"
                        type="button"
                        (click)="transition(plan, 'complete')"
                      >
                        {{ 'debtCollection.action.completePlan' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'debtCollection.plan.cancelConfirm' | translate"
                        (nzOnConfirm)="transition(plan, 'cancel')"
                      >
                        {{ 'debtCollection.action.cancelPlan' | translate }}
                      </button>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>

    <app-dc-exclusion-dialog
      [open]="flagType() !== null"
      [customerId]="customerId()"
      [presetType]="flagType() ?? 'manual'"
      [saving]="store.saving()"
      (submitted)="flag($event)"
      (closed)="flagType.set(null)"
    />
    <app-dc-note-dialog
      [open]="releasing() !== null"
      [saving]="store.saving()"
      (confirmed)="release($event)"
      (closed)="releasing.set(null)"
    />
    <app-dc-plan-dialog
      [open]="planOpen()"
      [customerId]="customerId()"
      [items]="store.items()"
      [saving]="store.saving()"
      (submitted)="createPlan($event)"
      (closed)="planOpen.set(false)"
    />
  `,
})
export class CustomerDunningComponent {
  protected readonly store = inject(CustomerDunningStore);
  private readonly lookups = inject(DcLookupsStore);
  private readonly feedback = inject(DcFeedback);

  /** Id of the customer (contact) whose dunning history is shown. */
  readonly customerId = input.required<string>();

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly flagType = signal<DcExclusionType | null>(null);
  protected readonly planOpen = signal(false);
  protected readonly releasing = signal<DcExclusion | null>(null);

  protected readonly levelTag = levelColor;
  protected readonly noticeTag = noticeStatusColor;
  protected readonly dossierTag = dossierStatusColor;
  protected readonly planTag = planStatusColor;

  constructor() {
    effect(() => {
      const id = this.customerId();
      untracked(() => {
        void this.lookups.ensureLoaded();
        void this.store.load(id);
      });
    });
  }

  protected openFlag(type: DcExclusionType): void {
    this.flagType.set(type);
  }

  protected openPlan(): void {
    void this.store.loadItems();
    this.planOpen.set(true);
  }

  protected async flag(payload: DcExclusionPayload): Promise<void> {
    if (
      this.feedback.report(await this.store.flag(payload), 'debtCollection.msg.exclusionCreated')
    ) {
      this.flagType.set(null);
    }
  }

  protected async release(note: string): Promise<void> {
    const row = this.releasing();
    if (
      row &&
      this.feedback.report(await this.store.release(row.id, note), 'debtCollection.msg.released')
    ) {
      this.releasing.set(null);
    }
  }

  protected async createPlan(payload: DcPaymentPlanPayload): Promise<void> {
    if (
      this.feedback.report(await this.store.createPlan(payload), 'debtCollection.msg.planCreated')
    ) {
      this.planOpen.set(false);
    }
  }

  protected async transition(plan: DcPaymentPlan, action: 'complete' | 'cancel'): Promise<void> {
    this.feedback.report(
      await this.store.transitionPlan(plan.id, action),
      'debtCollection.msg.planUpdated',
    );
  }

  protected async pdf(notice: DcNotice): Promise<void> {
    this.feedback.report(await this.store.downloadNoticePdf(notice.id, notice.number));
  }
}
