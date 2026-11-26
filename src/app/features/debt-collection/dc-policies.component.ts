import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DC_CURRENCIES,
  DC_INTEREST_BASES,
  DC_JURISDICTIONS,
  DC_LEVELS,
  DcPolicy,
  DcPolicyLevel,
  DcPolicyPayload,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { DcFeedback } from './dc-feedback.service';
import { DEBT_COLLECTION_MODULE } from './debt-collection.util';
import { DcLookupsStore } from './lookups.store';
import { SettingsStore } from './settings.store';

/** A new level row: reminder after the due date, no fee, no interest. */
export function emptyLevel(level: DcPolicyLevel['level'] = 1): DcPolicyLevel {
  return {
    level,
    min_days_overdue: level === 0 ? -3 : level * 10,
    wait_days: 0,
    deadline_days: 10,
    fee_amount: '0.00',
    charge_interest: level >= 2,
    channels: ['email'],
    legal_warning: level === 3,
    is_active: true,
  };
}

export function emptyPolicy(): DcPolicyPayload {
  return {
    name: '',
    jurisdiction: 'CH',
    currency: null,
    customer_id: null,
    is_default: false,
    is_active: true,
    min_overdue_amount: '0.00',
    interest_basis: 'actual_365',
    contractual_rate_percent: null,
    levels: [emptyLevel(1)],
  };
}

/** Dunning policies: the threshold, the interest basis and the levels (days overdue, wait, deadline, fee, channels). */
@Component({
  selector: 'app-dc-policies',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    ArCustomerSelectComponent,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="edit(null)">
          {{ 'debtCollection.action.newPolicy' | translate }}
        </button>
      }
    </div>

    <nz-table #table nzSize="small" [nzData]="store.policies()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th scope="col">{{ 'debtCollection.field.name' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.jurisdiction' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.currency' | translate }}</th>
          <th scope="col" class="num">{{ 'debtCollection.field.minOverdueAmount' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.interestBasis' | translate }}</th>
          <th scope="col" class="num">{{ 'debtCollection.policy.levelCount' | translate }}</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        @for (policy of table.data; track policy.id) {
          <tr>
            <th scope="row">
              {{ policy.name }}
              @if (policy.is_default) {
                <nz-tag nzColor="blue">{{ 'debtCollection.policy.default' | translate }}</nz-tag>
              }
              @if (!policy.is_active) {
                <nz-tag>{{ 'debtCollection.policy.inactive' | translate }}</nz-tag>
              }
            </th>
            <td>{{ 'debtCollection.jurisdiction.' + policy.jurisdiction | translate }}</td>
            <td>{{ policy.currency ?? ('debtCollection.action.all' | translate) }}</td>
            <td class="num">{{ policy.min_overdue_amount | money: policy.currency ?? 'CHF' }}</td>
            <td>{{ 'debtCollection.interestBasis.' + policy.interest_basis | translate }}</td>
            <td class="num">{{ policy.levels.length }}</td>
            <td>
              <div class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="edit(policy)">
                  {{
                    canWrite
                      ? ('debtCollection.action.edit' | translate)
                      : ('debtCollection.action.details' | translate)
                  }}
                </button>
                @if (canWrite) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'debtCollection.policy.deleteConfirm' | translate"
                    (nzOnConfirm)="remove(policy)"
                  >
                    {{ 'debtCollection.action.delete' | translate }}
                  </button>
                }
              </div>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (store.policies().length === 0) {
      <nz-empty [nzNotFoundContent]="'debtCollection.policy.empty' | translate" />
    }

    <nz-drawer
      [nzVisible]="draft() !== null"
      [nzWidth]="960"
      [nzTitle]="'debtCollection.policy.editor' | translate"
      (nzOnClose)="draft.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (draft(); as policy) {
          <div class="form-grid">
            <label class="field" for="dc-pol-name">
              <span>{{ 'debtCollection.field.name' | translate }}</span>
              <input
                nz-input
                id="dc-pol-name"
                maxlength="120"
                [disabled]="!canWrite"
                [ngModel]="policy.name"
                (ngModelChange)="patch({ name: $event })"
              />
            </label>
            <label class="field" for="dc-pol-jur">
              <span>{{ 'debtCollection.field.jurisdiction' | translate }}</span>
              <nz-select
                nzId="dc-pol-jur"
                [nzDisabled]="!canWrite"
                [ngModel]="policy.jurisdiction"
                (ngModelChange)="patch({ jurisdiction: $event })"
              >
                @for (value of jurisdictions; track value) {
                  <nz-option
                    [nzValue]="value"
                    [nzLabel]="'debtCollection.jurisdiction.' + value | translate"
                  />
                }
              </nz-select>
            </label>
            <label class="field" for="dc-pol-cur">
              <span>{{ 'debtCollection.field.currency' | translate }}</span>
              <nz-select
                nzId="dc-pol-cur"
                nzAllowClear
                [nzDisabled]="!canWrite"
                [nzPlaceHolder]="'debtCollection.action.all' | translate"
                [ngModel]="policy.currency"
                (ngModelChange)="patch({ currency: $event ?? null })"
              >
                @for (value of currencies; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="value" />
                }
              </nz-select>
            </label>
            <div class="field">
              <span>{{ 'debtCollection.policy.customerOverride' | translate }}</span>
              <app-ar-customer-select
                [customerId]="policy.customer_id"
                (customerChange)="patch({ customer_id: $event?.id ?? null })"
              />
            </div>
            <label class="field" for="dc-pol-min">
              <span>{{ 'debtCollection.field.minOverdueAmount' | translate }}</span>
              <input
                nz-input
                id="dc-pol-min"
                inputmode="decimal"
                [disabled]="!canWrite"
                [ngModel]="policy.min_overdue_amount"
                (ngModelChange)="patch({ min_overdue_amount: $event })"
              />
            </label>
            <label class="field" for="dc-pol-basis">
              <span>{{ 'debtCollection.field.interestBasis' | translate }}</span>
              <nz-select
                nzId="dc-pol-basis"
                [nzDisabled]="!canWrite"
                [ngModel]="policy.interest_basis"
                (ngModelChange)="patch({ interest_basis: $event })"
              >
                @for (value of bases; track value) {
                  <nz-option
                    [nzValue]="value"
                    [nzLabel]="'debtCollection.interestBasis.' + value | translate"
                  />
                }
              </nz-select>
            </label>
            <label class="field" for="dc-pol-rate">
              <span>{{ 'debtCollection.field.contractualRate' | translate }}</span>
              <input
                nz-input
                id="dc-pol-rate"
                inputmode="decimal"
                [disabled]="!canWrite"
                [ngModel]="policy.contractual_rate_percent ?? ''"
                (ngModelChange)="patch({ contractual_rate_percent: $event || null })"
              />
            </label>
            <div class="field">
              <label
                nz-checkbox
                for="dc-pol-default"
                nzId="dc-pol-default"
                [nzDisabled]="!canWrite"
                [ngModel]="policy.is_default"
                (ngModelChange)="patch({ is_default: $event })"
              >
                {{ 'debtCollection.policy.default' | translate }}
              </label>
              <label
                nz-checkbox
                for="dc-pol-active"
                nzId="dc-pol-active"
                [nzDisabled]="!canWrite"
                [ngModel]="policy.is_active"
                (ngModelChange)="patch({ is_active: $event })"
              >
                {{ 'debtCollection.field.active' | translate }}
              </label>
            </div>
          </div>

          <h4 class="section-title">{{ 'debtCollection.policy.levels' | translate }}</h4>
          <nz-table
            nzSize="small"
            [nzData]="policy.levels"
            [nzShowPagination]="false"
            nzTableLayout="fixed"
            [nzScroll]="{ x: '900px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'debtCollection.field.level' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.minDaysOverdue' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.waitDays' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.deadlineDays' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.fee' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.channels' | translate }}</th>
                <th scope="col">{{ 'debtCollection.policy.flags' | translate }}</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of policy.levels; track $index) {
                <tr>
                  <td>
                    <nz-select
                      [nzDisabled]="!canWrite"
                      [attr.aria-label]="'debtCollection.field.level' | translate"
                      [ngModel]="row.level"
                      (ngModelChange)="patchLevel($index, { level: $event })"
                    >
                      @for (value of levels; track value) {
                        <nz-option
                          [nzValue]="value"
                          [nzLabel]="'debtCollection.level.' + value | translate"
                        />
                      }
                    </nz-select>
                  </td>
                  <td>
                    <input
                      nz-input
                      type="number"
                      [attr.aria-label]="'debtCollection.field.minDaysOverdue' | translate"
                      [disabled]="!canWrite"
                      [ngModel]="row.min_days_overdue"
                      (ngModelChange)="patchLevel($index, { min_days_overdue: +$event })"
                    />
                  </td>
                  <td>
                    <input
                      nz-input
                      type="number"
                      min="0"
                      [attr.aria-label]="'debtCollection.field.waitDays' | translate"
                      [disabled]="!canWrite"
                      [ngModel]="row.wait_days"
                      (ngModelChange)="patchLevel($index, { wait_days: +$event })"
                    />
                  </td>
                  <td>
                    <input
                      nz-input
                      type="number"
                      min="0"
                      [attr.aria-label]="'debtCollection.field.deadlineDays' | translate"
                      [disabled]="!canWrite"
                      [ngModel]="row.deadline_days"
                      (ngModelChange)="patchLevel($index, { deadline_days: +$event })"
                    />
                  </td>
                  <td>
                    <input
                      nz-input
                      inputmode="decimal"
                      [attr.aria-label]="'debtCollection.field.fee' | translate"
                      [disabled]="!canWrite"
                      [ngModel]="row.fee_amount"
                      (ngModelChange)="patchLevel($index, { fee_amount: $event })"
                    />
                  </td>
                  <td>
                    <nz-select
                      nzMode="multiple"
                      [nzDisabled]="!canWrite"
                      [attr.aria-label]="'debtCollection.field.channels' | translate"
                      [ngModel]="row.channels"
                      (ngModelChange)="patchLevel($index, { channels: $event })"
                    >
                      @for (value of lookups.lookups().channels; track value) {
                        <nz-option
                          [nzValue]="value"
                          [nzLabel]="'debtCollection.channel.' + value | translate"
                        />
                      }
                    </nz-select>
                  </td>
                  <td>
                    <label
                      nz-checkbox
                      [attr.for]="'dc-pol-lvl-int-' + $index"
                      [nzId]="'dc-pol-lvl-int-' + $index"
                      [nzDisabled]="!canWrite"
                      [ngModel]="row.charge_interest"
                      (ngModelChange)="patchLevel($index, { charge_interest: $event })"
                    >
                      {{ 'debtCollection.field.chargeInterest' | translate }}
                    </label>
                    <label
                      nz-checkbox
                      [attr.for]="'dc-pol-lvl-warn-' + $index"
                      [nzId]="'dc-pol-lvl-warn-' + $index"
                      [nzDisabled]="!canWrite"
                      [ngModel]="row.legal_warning"
                      (ngModelChange)="patchLevel($index, { legal_warning: $event })"
                    >
                      {{ 'debtCollection.field.legalWarning' | translate }}
                    </label>
                    <label
                      nz-checkbox
                      [attr.for]="'dc-pol-lvl-act-' + $index"
                      [nzId]="'dc-pol-lvl-act-' + $index"
                      [nzDisabled]="!canWrite"
                      [ngModel]="row.is_active"
                      (ngModelChange)="patchLevel($index, { is_active: $event })"
                    >
                      {{ 'debtCollection.field.active' | translate }}
                    </label>
                  </td>
                  <td>
                    @if (canWrite) {
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        (click)="removeLevel($index)"
                      >
                        {{ 'debtCollection.action.remove' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (canWrite) {
            <div class="toolbar">
              <button nz-button type="button" (click)="addLevel()">
                {{ 'debtCollection.action.addLevel' | translate }}
              </button>
            </div>
            <div class="row-actions">
              <button nz-button type="button" (click)="draft.set(null)">
                {{ 'debtCollection.action.cancel' | translate }}
              </button>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!valid()"
                [nzLoading]="store.saving()"
                (click)="save()"
              >
                {{ 'debtCollection.action.save' | translate }}
              </button>
            </div>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class DcPoliciesComponent {
  protected readonly store = inject(SettingsStore);
  protected readonly lookups = inject(DcLookupsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly jurisdictions = DC_JURISDICTIONS;
  protected readonly currencies = DC_CURRENCIES;
  protected readonly bases = DC_INTEREST_BASES;
  protected readonly levels = DC_LEVELS;

  /** The policy in the editor: its payload and the id when it is an existing one. */
  protected readonly draft = signal<(DcPolicyPayload & { id: string | null }) | null>(null);

  protected readonly valid = computed(() => {
    const policy = this.draft();
    return (
      policy !== null &&
      policy.name.trim() !== '' &&
      policy.levels.length > 0 &&
      policy.levels.every(
        (row) => row.channels.length > 0 && row.deadline_days >= 0 && row.wait_days >= 0,
      )
    );
  });

  protected edit(policy: DcPolicy | null): void {
    this.draft.set(
      policy
        ? { ...policy, levels: policy.levels.map((row) => ({ ...row })) }
        : { ...emptyPolicy(), id: null },
    );
  }

  protected patch(change: Partial<DcPolicyPayload>): void {
    this.draft.update((policy) => (policy ? { ...policy, ...change } : policy));
  }

  protected patchLevel(index: number, change: Partial<DcPolicyLevel>): void {
    this.draft.update((policy) =>
      policy
        ? {
            ...policy,
            levels: policy.levels.map((row, i) => (i === index ? { ...row, ...change } : row)),
          }
        : policy,
    );
  }

  protected addLevel(): void {
    this.draft.update((policy) => {
      if (!policy) {
        return policy;
      }
      const next = Math.min(
        3,
        policy.levels.reduce((max, row) => Math.max(max, row.level), 0) + 1,
      ) as DcPolicyLevel['level'];
      return { ...policy, levels: [...policy.levels, emptyLevel(next)] };
    });
  }

  protected removeLevel(index: number): void {
    this.draft.update((policy) =>
      policy ? { ...policy, levels: policy.levels.filter((_, i) => i !== index) } : policy,
    );
  }

  protected async save(): Promise<void> {
    const policy = this.draft();
    if (!policy) {
      return;
    }
    const { id, ...payload } = policy;
    if (
      this.feedback.report(await this.store.savePolicy(id, payload), 'debtCollection.msg.saved')
    ) {
      this.draft.set(null);
    }
  }

  protected async remove(policy: DcPolicy): Promise<void> {
    this.feedback.report(await this.store.deletePolicy(policy.id), 'debtCollection.msg.deleted');
  }
}
