import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from '../cycle/shared/sales-api-helpers';
import { SalesWorkspaceApiService } from './sales-workspace-api.service';
import { percentOf, validateCallOffQuantity } from './sales-workspace.logic';
import { BlanketAgreement, DataEnvelope } from './sales-workspace.models';

type AgreementAction = 'activate' | 'suspend' | 'close' | 'renew';

const STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  active: 'green',
  suspended: 'orange',
  exhausted: 'purple',
  expired: 'volcano',
  closed: 'default',
};

/** Blanket agreements: consumption gauges, validity countdown, life cycle actions and the call-off wizard. */
@Component({
  selector: 'app-blanket-agreements',
  imports: [
    DecimalPipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'SWK.BA.TITLE' | translate"
      [subtitle]="'SWK.BA.SUBTITLE' | translate"
    />

    <nz-card>
      <div class="toolbar">
        <nz-select
          class="filter"
          nzAllowClear
          [nzPlaceHolder]="'SWK.BA.ALL_STATUSES' | translate"
          [ngModel]="status()"
          (ngModelChange)="setStatus($event)"
        >
          @for (s of statuses; track s) {
            <nz-option
              [nzValue]="s"
              [nzLabel]="'SWK.BA.STATUS.' + s.toUpperCase() | translate"
            ></nz-option>
          }
        </nz-select>
      </div>

      <nz-table
        #table
        nzSize="small"
        [nzData]="agreements()"
        [nzLoading]="loading()"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'SWK.COL.NUMBER' | translate }}</th>
            <th>{{ 'SWK.COL.CUSTOMER' | translate }}</th>
            <th>{{ 'SWK.COL.STATUS' | translate }}</th>
            <th>{{ 'SWK.BA.VALIDITY' | translate }}</th>
            <th>{{ 'SWK.BA.CALLED_OFF' | translate }}</th>
            <th class="num">{{ 'SWK.BA.REMAINING' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (a of table.data; track a.id) {
            <tr>
              <td>
                <code>{{ a.agreement_number }}</code>
              </td>
              <td>{{ a.customer_name ?? a.contact_id }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(a.status)">{{
                  'SWK.BA.STATUS.' + a.status.toUpperCase() | translate
                }}</nz-tag>
              </td>
              <td>
                {{ a.valid_from }} → {{ a.valid_to }}
                @if (a.status === 'active') {
                  <div class="hint">
                    {{ 'SWK.BA.DAYS_LEFT' | translate }}: {{ a.days_to_expiry }}
                  </div>
                }
              </td>
              <td class="gauge">
                <nz-progress nzSize="small" [nzPercent]="percent(a.called_off_percentage)" />
              </td>
              <td class="num">{{ a.remaining_amount | number: '1.2-2' }} {{ a.currency_code }}</td>
              <td class="row-actions">
                @if (a.status === 'draft' || a.status === 'suspended') {
                  <button nz-button nzSize="small" type="button" (click)="act(a, 'activate')">
                    {{ 'SWK.BA.ACTIVATE' | translate }}
                  </button>
                }
                @if (a.status === 'active') {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    (click)="openCallOff(a)"
                  >
                    {{ 'SWK.BA.CALL_OFF' | translate }}
                  </button>
                  <button nz-button nzSize="small" type="button" (click)="act(a, 'suspend')">
                    {{ 'SWK.BA.SUSPEND' | translate }}
                  </button>
                }
                @if (a.status === 'active' || a.status === 'exhausted' || a.status === 'expired') {
                  <button nz-button nzSize="small" type="button" (click)="act(a, 'renew')">
                    {{ 'SWK.BA.RENEW' | translate }}
                  </button>
                }
                @if (a.status !== 'closed') {
                  <button nz-button nzSize="small" nzDanger type="button" (click)="act(a, 'close')">
                    {{ 'SWK.BA.CLOSE' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="callOffTarget() !== null"
      [nzTitle]="'SWK.BA.CALL_OFF' | translate"
      [nzOkText]="'SWK.BA.CALL_OFF' | translate"
      [nzOkDisabled]="!callOffValid()"
      [nzOkLoading]="working()"
      nzWidth="720"
      (nzOnOk)="submitCallOff()"
      (nzOnCancel)="callOffTarget.set(null)"
    >
      <ng-container *nzModalContent>
        @if (callOffTarget(); as target) {
          <nz-table nzSize="small" [nzData]="target.lines ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'SWK.COL.PRODUCT' | translate }}</th>
                <th class="num">{{ 'SWK.BA.REMAINING' | translate }}</th>
                <th>{{ 'SWK.BA.RELEASE_QTY' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (line of target.lines ?? []; track line.id) {
                <tr>
                  <td>{{ line.description }}</td>
                  <td class="num">{{ line.remaining_quantity | number: '1.0-4' }}</td>
                  <td>
                    <nz-input-number
                      [nzMin]="0"
                      [ngModel]="releaseQty()[line.id] ?? 0"
                      (ngModelChange)="setRelease(line.id, $event)"
                      [attr.aria-label]="'SWK.BA.RELEASE_QTY' | translate"
                    />
                  </td>
                  <td>
                    @if (lineCheck(line.id) === 'exceeds_balance') {
                      <nz-tag nzColor="red">{{ 'SWK.BA.EXCEEDS' | translate }}</nz-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      margin-bottom: 12px;
    }
    .filter {
      min-width: 220px;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .gauge {
      min-width: 140px;
    }
    .hint {
      font-size: 12px;
      opacity: 0.75;
    }
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
})
export class BlanketAgreementsComponent {
  private readonly api = inject(SalesWorkspaceApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = ['draft', 'active', 'suspended', 'exhausted', 'expired', 'closed'];
  protected readonly agreements = signal<BlanketAgreement[]>([]);
  protected readonly loading = signal(false);
  protected readonly working = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly callOffTarget = signal<BlanketAgreement | null>(null);
  protected readonly releaseQty = signal<Record<string, number>>({});

  protected readonly callOffValid = computed(() => {
    const target = this.callOffTarget();
    if (!target) {
      return false;
    }
    const entered = (target.lines ?? []).filter((line) => (this.releaseQty()[line.id] ?? 0) > 0);
    return entered.length > 0 && entered.every((line) => this.lineCheck(line.id) === 'ok');
  });

  constructor() {
    this.load();
  }

  protected statusColor(status: string): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected percent(value: string): number {
    return Math.round(percentOf(value));
  }

  protected setStatus(status: string | null): void {
    this.status.set(status);
    this.load();
  }

  protected openCallOff(agreement: BlanketAgreement): void {
    this.api
      .getAgreement(agreement.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.releaseQty.set({});
        this.callOffTarget.set(res.data);
      });
  }

  protected setRelease(lineId: string, value: number | null): void {
    this.releaseQty.update((current) => ({ ...current, [lineId]: value ?? 0 }));
  }

  /** Validation of the quantity entered for a line against the contract balance and tolerance. */
  protected lineCheck(lineId: string) {
    const target = this.callOffTarget();
    const line = target?.lines?.find((l) => l.id === lineId);
    const quantity = this.releaseQty()[lineId] ?? 0;
    if (!target || !line || quantity <= 0) {
      return 'invalid' as const;
    }
    return validateCallOffQuantity(line, quantity, Number(target.over_release_tolerance_percent));
  }

  protected submitCallOff(): void {
    const target = this.callOffTarget();
    if (!target || !this.callOffValid()) {
      return;
    }
    const lines = Object.entries(this.releaseQty())
      .filter(([, quantity]) => quantity > 0)
      .map(([blanket_agreement_line_id, quantity]) => ({ blanket_agreement_line_id, quantity }));
    this.working.set(true);
    this.api
      .callOff(target.id, { lines })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.working.set(false);
          this.callOffTarget.set(null);
          this.message.success(this.i18n.translate('SWK.BA.CALL_OFF_CREATED'));
          void this.router.navigate(['/sales/workspace/orders', res.data.id]);
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  protected act(agreement: BlanketAgreement, action: AgreementAction): void {
    this.working.set(true);
    const calls: Record<AgreementAction, () => Observable<DataEnvelope<BlanketAgreement>>> = {
      activate: () => this.api.activateAgreement(agreement.id),
      suspend: () => this.api.suspendAgreement(agreement.id),
      close: () => this.api.closeAgreement(agreement.id),
      renew: () => this.api.renewAgreement(agreement.id),
    };
    calls[action]()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.working.set(false);
          this.load();
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .listAgreements({
        ...(this.status() ? { status: this.status() as string } : {}),
        per_page: 50,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.agreements.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.agreements.set([]);
          this.loading.set(false);
        },
      });
  }

  private fail(err: unknown): void {
    this.working.set(false);
    this.message.error(apiErrorText(err) || this.i18n.translate('SWK.MSG.ERROR'));
  }
}
