import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  IcLinkStatus,
  IcNettingRun,
  IcPaymentStatus,
  IcTransaction,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { IntercompanyContextStore } from './intercompany-context.store';
import { IntercompanyNotifier } from './intercompany-notifier.service';
import { IntercompanyReasonDialogComponent } from './intercompany-reason-dialog.component';
import { IntercompanyTransactionsStore } from './intercompany-transactions.store';
import {
  enumKey,
  IC_LINK_STATUSES,
  IC_MODULE,
  IC_PAYMENT_STATUSES,
  isNonZero,
  linkStatusColor,
  nettingStatusColor,
  paymentStatusColor,
} from './intercompany.util';

/** Mirror postings between the entities of the group, the sync of their payments, and the netting (compensation) of open items. */
@Component({
  selector: 'app-intercompany-transactions',
  styleUrl: './intercompany.scss',
  providers: [IntercompanyTransactionsStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    IntercompanyReasonDialogComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    @if (store.summary(); as summary) {
      <div class="kpis">
        <nz-card nzSize="small"
          ><strong>{{ summary.total }}</strong
          ><br />{{ 'intercompany.transactions.kpiTotal' | translate }}</nz-card
        >
        <nz-card nzSize="small"
          ><strong>{{ summary.drafted }}</strong
          ><br />{{ 'intercompany.enum.linkStatus.drafted' | translate }}</nz-card
        >
        <nz-card nzSize="small"
          ><strong>{{ summary.confirmed }}</strong
          ><br />{{ 'intercompany.enum.linkStatus.confirmed' | translate }}</nz-card
        >
        <nz-card nzSize="small"
          ><strong>{{ summary.failed }}</strong
          ><br />{{ 'intercompany.enum.linkStatus.failed' | translate }}</nz-card
        >
        <nz-card nzSize="small"
          ><strong>{{ summary.unpaid }}</strong
          ><br />{{ 'intercompany.enum.paymentStatus.unpaid' | translate }}</nz-card
        >
        @for (entry of currencyTotals(summary.amount_by_currency); track entry[0]) {
          <nz-card nzSize="small"
            ><strong>{{ entry[1] | money: entry[0] }}</strong
            ><br />{{ entry[0] }}</nz-card
          >
        }
      </div>
    }

    <div class="toolbar">
      <label for="ic-tx-status">{{ 'intercompany.transactions.status' | translate }}</label>
      <nz-select
        id="ic-tx-status"
        class="select-sm"
        nzAllowClear
        [ngModel]="store.filters().status"
        (ngModelChange)="filter({ status: $event })"
      >
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="enumKey('linkStatus', status) | translate" />
        }
      </nz-select>
      <label for="ic-tx-pay">{{ 'intercompany.transactions.paymentStatus' | translate }}</label>
      <nz-select
        id="ic-tx-pay"
        class="select-sm"
        nzAllowClear
        [ngModel]="store.filters().payment_status"
        (ngModelChange)="filter({ payment_status: $event })"
      >
        @for (status of paymentStatuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="enumKey('paymentStatus', status) | translate" />
        }
      </nz-select>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button type="button" [nzLoading]="store.loading()" (click)="scan()">
          {{ 'intercompany.transactions.scan' | translate }}
        </button>
      }
    </div>
    @if (store.lastScan(); as scanned) {
      <p class="muted">
        {{
          'intercompany.transactions.scanResult'
            | translate
              : { created: scanned.created, skipped: scanned.skipped, failed: scanned.failed }
        }}
      </p>
    }

    <nz-table
      #table
      nzSize="small"
      [nzFrontPagination]="false"
      [nzData]="store.transactions()"
      [nzLoading]="store.loading()"
      [nzTotal]="store.total()"
      [nzPageIndex]="store.filters().page ?? 1"
      [nzPageSize]="store.filters().per_page ?? 20"
      (nzPageIndexChange)="filter({ page: $event }, false)"
      [nzScroll]="{ x: '1180px' }"
    >
      <thead>
        <tr>
          <th>{{ 'intercompany.transactions.document' | translate }}</th>
          <th>{{ 'intercompany.transactions.source' | translate }}</th>
          <th>{{ 'intercompany.transactions.mirror' | translate }}</th>
          <th class="num">{{ 'intercompany.transactions.gross' | translate }}</th>
          <th>{{ 'intercompany.transactions.status' | translate }}</th>
          <th>{{ 'intercompany.transactions.paymentStatus' | translate }}</th>
          <th class="num">{{ 'intercompany.transactions.paidVariance' | translate }}</th>
          <th>{{ 'intercompany.common.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>
              <a href="javascript:void(0)" (click)="store.openDetail(row.id)">{{
                row.source_document_number
              }}</a>
              <br /><span class="muted"
                >{{ enumKey('documentType', row.document_type) | translate }} -
                {{ row.document_date }}</span
              >
            </td>
            <td>{{ row.source_tenant_name }}</td>
            <td>
              {{ row.mirror_tenant_name }}
              @if (row.mirror_document_number) {
                <br /><span class="muted">{{ row.mirror_document_number }}</span>
              }
              @if (row.mirror_status; as mirrorStatus) {
                <nz-tag>{{ enumKey('mirrorMode', mirrorStatus) | translate }}</nz-tag>
              }
            </td>
            <td class="num">{{ row.gross_amount | money: row.currency }}</td>
            <td>
              <nz-tag [nzColor]="statusColor(row.status)">{{
                enumKey('linkStatus', row.status) | translate
              }}</nz-tag>
              @if (row.error_message) {
                <br /><span class="muted">{{ row.error_message }}</span>
              }
            </td>
            <td>
              <nz-tag [nzColor]="payColor(row.payment_status)">{{
                enumKey('paymentStatus', row.payment_status) | translate
              }}</nz-tag>
            </td>
            <td class="num">
              @if (hasVariance(row.paid_variance)) {
                <nz-tag nzColor="red">{{ row.paid_variance | money: row.currency }}</nz-tag>
              } @else {
                -
              }
            </td>
            <td>
              @if (canWrite) {
                @if (
                  row.status === 'pending' || row.status === 'failed' || row.status === 'skipped'
                ) {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="busy(row)"
                    (click)="mirror(row)"
                  >
                    {{ 'intercompany.transactions.createMirror' | translate }}
                  </button>
                }
                @if (row.status === 'drafted') {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    [disabled]="busy(row)"
                    (click)="confirm(row)"
                  >
                    {{ 'intercompany.transactions.confirm' | translate }}
                  </button>
                }
                @if (row.status === 'drafted' || row.status === 'confirmed') {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="busy(row)"
                    (click)="syncPayment(row)"
                  >
                    {{ 'intercompany.transactions.syncPayment' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    [disabled]="busy(row)"
                    (click)="askReverse(row)"
                  >
                    {{ 'intercompany.transactions.reverse' | translate }}
                  </button>
                }
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-card [nzTitle]="'intercompany.transactions.netting' | translate" class="section">
      <p class="muted">{{ 'intercompany.transactions.nettingHint' | translate }}</p>
      @if (canWrite) {
        <form [formGroup]="nettingForm" (ngSubmit)="proposeNetting()" class="form-row">
          <div>
            <label for="ic-net-a">{{ 'intercompany.transactions.entityA' | translate }}</label>
            <nz-select id="ic-net-a" formControlName="entity_a_tenant_id" class="select-md">
              @for (member of ctx.members(); track member.id) {
                <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-net-b">{{ 'intercompany.transactions.entityB' | translate }}</label>
            <nz-select id="ic-net-b" formControlName="entity_b_tenant_id" class="select-md">
              @for (member of ctx.members(); track member.id) {
                <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-net-date">{{ 'intercompany.transactions.asOf' | translate }}</label>
            <input id="ic-net-date" nz-input type="date" formControlName="as_of_date" />
          </div>
          <button nz-button nzType="primary" type="submit" [disabled]="nettingForm.invalid">
            {{ 'intercompany.transactions.proposeNetting' | translate }}
          </button>
        </form>
      }
      <nz-table
        #netting
        nzSize="small"
        [nzData]="store.nettingRuns()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '900px' }"
      >
        <thead>
          <tr>
            <th>
              {{ 'intercompany.transactions.entityA' | translate }} /
              {{ 'intercompany.transactions.entityB' | translate }}
            </th>
            <th>{{ 'intercompany.transactions.asOf' | translate }}</th>
            <th class="num">{{ 'intercompany.transactions.receivableTotal' | translate }}</th>
            <th class="num">{{ 'intercompany.transactions.payableTotal' | translate }}</th>
            <th class="num">{{ 'intercompany.transactions.netAmount' | translate }}</th>
            <th>{{ 'intercompany.transactions.netDirection' | translate }}</th>
            <th class="num">{{ 'intercompany.transactions.fxVariance' | translate }}</th>
            <th>{{ 'intercompany.transactions.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (run of netting.data; track run.id) {
            <tr>
              <td>
                {{ ctx.memberName(run.entity_a_tenant_id) }} /
                {{ ctx.memberName(run.entity_b_tenant_id) }}
              </td>
              <td>{{ run.as_of_date }}</td>
              <td class="num">{{ run.receivable_total | money: run.currency }}</td>
              <td class="num">{{ run.payable_total | money: run.currency }}</td>
              <td class="num">{{ run.net_amount | money: run.currency }}</td>
              <td>{{ 'intercompany.transactions.direction.' + run.net_direction | translate }}</td>
              <td class="num">{{ run.fx_variance | money: run.currency }}</td>
              <td>
                <nz-tag [nzColor]="netColor(run.status)">{{
                  enumKey('nettingStatus', run.status) | translate
                }}</nz-tag>
              </td>
              <td>
                @if (canWrite && run.status === 'draft') {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'intercompany.transactions.confirmNetting' | translate"
                    (nzOnConfirm)="confirmNetting(run)"
                  >
                    {{ 'intercompany.transactions.confirm' | translate }}
                  </button>
                  <button nz-button nzSize="small" type="button" (click)="askCancelNetting(run)">
                    {{ 'intercompany.common.cancel' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="store.detail() !== null"
      nzWidth="520"
      [nzTitle]="'intercompany.transactions.detail' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (store.detail(); as detail) {
          <p>
            <strong>{{ detail.source_document_number }}</strong> ({{ detail.source_tenant_name }}) →
            <strong>{{ detail.mirror_document_number ?? '-' }}</strong> ({{
              detail.mirror_tenant_name
            }})
          </p>
          <p class="muted">
            {{ 'intercompany.transactions.pairId' | translate }}: {{ detail.pair_id }}
          </p>
          <h4>{{ 'intercompany.transactions.syncLog' | translate }}</h4>
          <ul>
            @for (event of detail.events ?? []; track event.id) {
              <li>
                {{ event.occurred_at }} - {{ enumKey('syncEvent', event.event) | translate }}
                @if (event.amount) {
                  ({{ event.amount | money: detail.currency }})
                }
                @if (event.message_key) {
                  <br /><span class="muted">{{ event.message_key | translate }}</span>
                }
              </li>
            }
          </ul>
        }
      </ng-container>
    </nz-drawer>

    <app-intercompany-reason-dialog
      [(open)]="reverseOpen"
      titleKey="intercompany.transactions.reverse"
      (confirmed)="reverse($event.reason)"
    />
    <app-intercompany-reason-dialog
      [(open)]="cancelOpen"
      titleKey="intercompany.transactions.cancelNetting"
      (confirmed)="cancelNetting($event.reason)"
    />
  `,
})
export class IntercompanyTransactionsComponent {
  protected readonly ctx = inject(IntercompanyContextStore);
  protected readonly store = inject(IntercompanyTransactionsStore);
  private readonly notifier = inject(IntercompanyNotifier);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly canWrite = inject(PermissionsService).canWrite(IC_MODULE);

  protected readonly enumKey = enumKey;
  protected readonly statuses: readonly IcLinkStatus[] = IC_LINK_STATUSES;
  protected readonly paymentStatuses: readonly IcPaymentStatus[] = IC_PAYMENT_STATUSES;
  protected readonly statusColor = linkStatusColor;
  protected readonly payColor = paymentStatusColor;
  protected readonly netColor = nettingStatusColor;
  protected readonly reverseOpen = signal(false);
  protected readonly cancelOpen = signal(false);
  private pending: IcTransaction | IcNettingRun | null = null;

  protected readonly nettingForm = this.fb.group({
    entity_a_tenant_id: ['', Validators.required],
    entity_b_tenant_id: ['', Validators.required],
    as_of_date: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const groupId = this.ctx.groupId();
      if (groupId !== null) {
        untracked(() => {
          void this.store.load(groupId, { page: 1, per_page: 20 });
          void this.store.loadNetting(groupId);
        });
      }
    });
  }

  protected currencyTotals(totals: Record<string, string>): [string, string][] {
    return Object.entries(totals);
  }

  protected hasVariance(value: string): boolean {
    return isNonZero(value);
  }

  protected busy(row: IcTransaction): boolean {
    return this.store.busy().includes(row.id);
  }

  protected filter(change: Record<string, unknown>, resetPage = true): void {
    const groupId = this.ctx.groupId();
    if (groupId !== null) {
      void this.store.load(groupId, {
        ...this.store.filters(),
        ...(resetPage ? { page: 1 } : {}),
        ...change,
      });
    }
  }

  protected async scan(): Promise<void> {
    const groupId = this.ctx.groupId();
    if (groupId !== null) {
      this.notifier.report(await this.store.scan(groupId), 'intercompany.transactions.scanDone');
    }
  }

  protected async mirror(row: IcTransaction): Promise<void> {
    this.notifier.report(await this.store.mirror(row.id), 'intercompany.transactions.mirrorDone');
  }

  protected async confirm(row: IcTransaction): Promise<void> {
    this.notifier.report(await this.store.confirm(row.id), 'intercompany.transactions.confirmDone');
  }

  protected async syncPayment(row: IcTransaction): Promise<void> {
    this.notifier.report(
      await this.store.syncPayment(row.id),
      'intercompany.transactions.syncDone',
    );
  }

  protected askReverse(row: IcTransaction): void {
    this.pending = row;
    this.reverseOpen.set(true);
  }

  protected async reverse(reason: string): Promise<void> {
    const row = this.pending as IcTransaction | null;
    if (row !== null) {
      this.notifier.report(
        await this.store.reverse(row.id, reason),
        'intercompany.transactions.reverseDone',
      );
    }
  }

  protected async proposeNetting(): Promise<void> {
    const groupId = this.ctx.groupId();
    if (groupId !== null && this.nettingForm.valid) {
      this.notifier.report(
        await this.store.proposeNetting(groupId, this.nettingForm.getRawValue()),
        'intercompany.transactions.nettingProposed',
      );
    }
  }

  protected async confirmNetting(run: IcNettingRun): Promise<void> {
    this.notifier.report(
      await this.store.confirmNetting(run.id),
      'intercompany.transactions.nettingConfirmed',
    );
  }

  protected askCancelNetting(run: IcNettingRun): void {
    this.pending = run;
    this.cancelOpen.set(true);
  }

  protected async cancelNetting(reason: string): Promise<void> {
    const run = this.pending as IcNettingRun | null;
    if (run !== null) {
      this.notifier.report(await this.store.cancelNetting(run.id, reason));
    }
  }
}
