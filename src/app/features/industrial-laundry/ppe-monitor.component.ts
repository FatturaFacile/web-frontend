import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { IlrPpeAlert, IlrPpeDecision } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { IlrOutcome, lifecycleColor, ppeStatusColor, wearPercent } from './industrial-laundry.util';
import { PpeMonitorStore } from './ppe-monitor.store';

/** PPE wash cycle limit monitor (EN ISO 20471, EN ISO 11612, EN 13034, manufacturer limit) with one-click decisions. */
@Component({
  selector: 'app-ilr-ppe-monitor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [PpeMonitorStore],
  styleUrl: './industrial-laundry.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.INDUSTRIAL_LAUNDRY_PPE' | translate"></app-page-header>

    <div class="stats-grid">
      <nz-statistic [nzTitle]="'industrialLaundry.ppeStatus.limit_reached' | translate" [nzValue]="store.reachedCount()"></nz-statistic>
      <nz-statistic [nzTitle]="'industrialLaundry.ppeStatus.near_limit' | translate" [nzValue]="store.nearCount()"></nz-statistic>
    </div>

    <div class="toolbar">
      <label class="field wide" for="ilr-ppe-customer">
        <span>{{ 'industrialLaundry.field.customer' | translate }}</span>
        <nz-select
          id="ilr-ppe-customer"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.customerId()"
          (ngModelChange)="store.setFilters({ customerId: $event })"
          [nzPlaceHolder]="'industrialLaundry.field.allCustomers' | translate"
        >
          @for (customer of store.customers(); track customer.id) {
            <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
          }
        </nz-select>
      </label>
      <label nz-checkbox [ngModel]="store.limitReachedOnly()" (ngModelChange)="store.setFilters({ limitReachedOnly: $event })">
        {{ 'industrialLaundry.field.limitReachedOnly' | translate }}
      </label>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table nzSize="small" [nzData]="store.alerts()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'industrialLaundry.field.epc' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.wearer' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.standard' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.washCycles' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.status' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.state' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (alert of store.alerts(); track alert.id) {
            <tr>
              <th scope="row" class="mono">{{ alert.epc_uid_rfid_hex }}</th>
              <td>
                {{ alert.assigned_wearer_employee_name }}
                @if (alert.assigned_locker_code) {
                  <span class="hint"> · {{ alert.assigned_locker_code }}</span>
                }
                <div class="hint">{{ store.customerName()(alert.assigned_customer_id) }}</div>
              </td>
              <td>
                {{ alert.ppe_certification_standard }}
                @if (alert.ppe_category) {
                  <nz-tag>{{ 'industrialLaundry.field.category' | translate }} {{ alert.ppe_category }}</nz-tag>
                }
              </td>
              <td>
                <nz-progress
                  nzSize="small"
                  [nzPercent]="wear(alert)"
                  [nzStatus]="alert.status === 'limit_reached' ? 'exception' : 'active'"
                  [nzFormat]="format"
                ></nz-progress>
                <span class="hint">{{ alert.wash_cycles_count }} / {{ alert.max_certified_wash_cycles_limit }}</span>
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(alert.status)">{{ 'industrialLaundry.ppeStatus.' + alert.status | translate }}</nz-tag>
                @if (alert.is_reissue_blocked) {
                  <nz-tag nzColor="red">{{ 'industrialLaundry.field.reissueBlocked' | translate }}</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="stateColor(alert.current_lifecycle_state)">
                  {{ 'industrialLaundry.lifecycleState.' + alert.current_lifecycle_state | translate }}
                </nz-tag>
              </td>
              <td>
                @if (alert.status === 'limit_reached') {
                  <button nz-button nzSize="small" nzType="primary" type="button" (click)="openReplace(alert)">
                    {{ 'industrialLaundry.action.replace' | translate }}
                  </button>
                  @if (alert.current_lifecycle_state !== 'in_mending') {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'industrialLaundry.confirm.mend' | translate"
                      (nzOnConfirm)="decide(alert, 'mend')"
                    >{{ 'industrialLaundry.action.mend' | translate }}</button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'industrialLaundry.confirm.condemn' | translate"
                    (nzOnConfirm)="decide(alert, 'condemn')"
                  >{{ 'industrialLaundry.action.condemn' | translate }}</button>
                }
                @if (alert.current_lifecycle_state === 'in_mending') {
                  <button nz-button nzSize="small" type="button" (click)="decide(alert, 'complete_mending')">
                    {{ 'industrialLaundry.action.completeMending' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (store.alerts().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'industrialLaundry.empty.ppe' | translate"></nz-empty>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="replacing() !== null"
      [nzTitle]="'industrialLaundry.section.replacePpe' | translate"
      [nzOkText]="'industrialLaundry.action.replace' | translate"
      [nzCancelText]="'industrialLaundry.action.cancel' | translate"
      [nzOkDisabled]="replacementEpc().trim() === ''"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="replace()"
      (nzOnCancel)="replacing.set(null)"
    >
      <ng-container *nzModalContent>
        @if (modalFailure(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
            [nzDescription]="failure.detail ?? undefined"
          ></nz-alert>
        }
        <label class="field" for="ilr-ppe-epc">
          <span>{{ 'industrialLaundry.field.replacementEpc' | translate }}</span>
          <input nz-input id="ilr-ppe-epc" maxlength="80" [ngModel]="replacementEpc()" (ngModelChange)="replacementEpc.set($event)" />
        </label>
        <p class="hint">{{ 'industrialLaundry.hint.replacePpe' | translate }}</p>
      </ng-container>
    </nz-modal>
  `,
})
export class PpeMonitorComponent implements OnInit {
  protected readonly store = inject(PpeMonitorStore);
  protected readonly feedback = signal<IlrOutcome | null>(null);
  protected readonly modalFailure = signal<IlrOutcome | null>(null);
  protected readonly replacing = signal<IlrPpeAlert | null>(null);
  protected readonly replacementEpc = signal('');
  protected readonly statusColor = ppeStatusColor;
  protected readonly stateColor = lifecycleColor;
  protected readonly format = (percent: number): string => `${percent}%`;

  ngOnInit(): void {
    void this.store.init();
  }

  protected wear(alert: IlrPpeAlert): number {
    return Math.min(100, wearPercent(alert.wash_cycles_count, alert.max_certified_wash_cycles_limit));
  }

  protected openReplace(alert: IlrPpeAlert): void {
    this.replacementEpc.set('');
    this.modalFailure.set(null);
    this.replacing.set(alert);
  }

  protected async replace(): Promise<void> {
    const alert = this.replacing();
    if (alert === null) {
      return;
    }
    const outcome = await this.store.decide(alert.id, { action: 'replace', replacement_epc: this.replacementEpc().trim() });
    if (outcome.ok) {
      this.replacing.set(null);
      this.feedback.set(null);
    } else {
      this.modalFailure.set(outcome);
    }
  }

  protected async decide(alert: IlrPpeAlert, action: IlrPpeDecision): Promise<void> {
    const outcome = await this.store.decide(alert.id, { action });
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
