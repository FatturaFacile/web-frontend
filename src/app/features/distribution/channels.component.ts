import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DST_ALLOCATION_MODES,
  DST_CHANNEL_TYPES,
  DstAllocationMode,
  DstChannel,
  DstChannelRule,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DISTRIBUTION_MODULE, DstOutcome, formatQuantity, numberOrNull } from './distribution.util';
import { ChannelsStore } from './channels.store';

/** Sales channels and their warehouse allocation rules: shared pool, percentage, fixed reserve and priority rank. */
@Component({
  selector: 'app-dst-channels',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [ChannelsStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_CHANNELS' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'distribution.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <div class="toolbar">
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openChannel(null)">
          {{ 'distribution.action.newChannel' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.channels()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '700px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'distribution.field.code' | translate }}</th>
            <th scope="col">{{ 'distribution.field.name' | translate }}</th>
            <th scope="col">{{ 'distribution.field.channelType' | translate }}</th>
            <th scope="col" class="num">{{ 'distribution.field.priority' | translate }}</th>
            <th scope="col">{{ 'distribution.field.status' | translate }}</th>
            <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr [class.selected]="row.id === store.selectedId()">
              <th scope="row">{{ row.code }}</th>
              <td>{{ row.name }}</td>
              <td>{{ 'distribution.channelType.' + row.channel_type | translate }}</td>
              <td class="num">{{ row.priority }}</td>
              <td>
                <nz-tag [nzColor]="row.is_active ? 'green' : 'default'">{{
                  (row.is_active ? 'distribution.field.active' : 'distribution.field.inactive')
                    | translate
                }}</nz-tag>
              </td>
              <td class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="store.select(row.id)">
                  {{ 'distribution.action.showRules' | translate }}
                </button>
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openChannel(row)">
                    {{ 'distribution.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'distribution.confirm.deleteChannel' | translate"
                    [nzOkText]="'distribution.action.confirm' | translate"
                    [nzCancelText]="'distribution.action.cancel' | translate"
                    (nzOnConfirm)="removeChannel(row)"
                  >
                    {{ 'distribution.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">
                <nz-empty
                  [nzNotFoundContent]="'distribution.empty.channels' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>

      @if (store.selectedId()) {
        <h3>{{ 'distribution.section.channelRules' | translate }}</h3>
        <div class="toolbar">
          <span class="spacer"></span>
          @if (canWrite) {
            <button nz-button type="button" (click)="openRule(null)">
              {{ 'distribution.action.newChannelRule' | translate }}
            </button>
          }
        </div>
        <nz-table
          #rules
          nzSize="small"
          [nzData]="store.rules()"
          [nzShowPagination]="false"
          [nzScroll]="{ x: '900px' }"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
              <th scope="col">{{ 'distribution.field.allocationMode' | translate }}</th>
              <th scope="col">{{ 'distribution.field.allocationValue' | translate }}</th>
              <th scope="col">{{ 'distribution.field.includeInTransit' | translate }}</th>
              <th scope="col">{{ 'distribution.field.excludeConsignment' | translate }}</th>
              <th scope="col">{{ 'distribution.field.exclude3pl' | translate }}</th>
              <th scope="col" class="num">{{ 'distribution.field.safetyBuffer' | translate }}</th>
              <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (rule of rules.data; track rule.id) {
              <tr>
                <th scope="row">{{ rule.warehouse?.code }} {{ rule.warehouse?.name }}</th>
                <td>{{ 'distribution.allocationMode.' + rule.allocation_mode | translate }}</td>
                <td>{{ allocationValue(rule) }}</td>
                <td>
                  {{
                    (rule.include_in_transit ? 'distribution.field.yes' : 'distribution.field.no')
                      | translate
                  }}
                </td>
                <td>
                  {{
                    (rule.exclude_consignment ? 'distribution.field.yes' : 'distribution.field.no')
                      | translate
                  }}
                </td>
                <td>
                  {{
                    (rule.exclude_3pl ? 'distribution.field.yes' : 'distribution.field.no')
                      | translate
                  }}
                </td>
                <td class="num">
                  {{ rule.safety_buffer_qty === null ? '—' : quantity(rule.safety_buffer_qty) }}
                </td>
                <td class="row-actions">
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" (click)="openRule(rule)">
                      {{ 'distribution.action.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'distribution.confirm.deleteChannelRule' | translate"
                      [nzOkText]="'distribution.action.confirm' | translate"
                      [nzCancelText]="'distribution.action.cancel' | translate"
                      (nzOnConfirm)="removeRule(rule)"
                    >
                      {{ 'distribution.action.delete' | translate }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">
                  <nz-empty
                    [nzNotFoundContent]="'distribution.empty.channelRules' | translate"
                  ></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="channelOpen()"
      [nzWidth]="460"
      [nzTitle]="'distribution.section.channel' | translate"
      (nzOnClose)="channelOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'distribution.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="channelForm" class="form" (ngSubmit)="submitChannel()">
          <label class="field" for="dst-ch-code">
            <span>{{ 'distribution.field.code' | translate }}</span>
            <input nz-input id="dst-ch-code" formControlName="code" maxlength="40" />
          </label>
          <label class="field" for="dst-ch-name">
            <span>{{ 'distribution.field.name' | translate }}</span>
            <input nz-input id="dst-ch-name" formControlName="name" maxlength="160" />
          </label>
          <label class="field" for="dst-ch-type">
            <span>{{ 'distribution.field.channelType' | translate }}</span>
            <nz-select nzId="dst-ch-type" formControlName="channel_type">
              @for (type of channelTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'distribution.channelType.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-ch-priority">
            <span>{{ 'distribution.field.priority' | translate }}</span>
            <nz-input-number
              nzId="dst-ch-priority"
              formControlName="priority"
              [nzMin]="1"
              [nzStep]="1"
            ></nz-input-number>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.active' | translate }}</span>
            <nz-switch formControlName="is_active"></nz-switch>
          </label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="channelForm.invalid"
            >
              {{ 'distribution.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="channelOpen.set(false)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="ruleOpen()"
      [nzWidth]="500"
      [nzTitle]="'distribution.section.channelRule' | translate"
      (nzOnClose)="ruleOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'distribution.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="ruleForm" class="form" (ngSubmit)="submitRule()">
          <label class="field" for="dst-cr-warehouse">
            <span>{{ 'distribution.field.warehouse' | translate }}</span>
            <nz-select nzId="dst-cr-warehouse" formControlName="warehouse_id" nzShowSearch>
              @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-cr-mode">
            <span>{{ 'distribution.field.allocationMode' | translate }}</span>
            <nz-select nzId="dst-cr-mode" formControlName="allocation_mode">
              @for (mode of modes; track mode) {
                <nz-option
                  [nzValue]="mode"
                  [nzLabel]="'distribution.allocationMode.' + mode | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          @if (mode() === 'percentage') {
            <label class="field" for="dst-cr-pct">
              <span>{{ 'distribution.field.allocationPercentage' | translate }}</span>
              <nz-input-number
                nzId="dst-cr-pct"
                formControlName="allocation_percentage"
                [nzMin]="0"
                [nzMax]="100"
              ></nz-input-number>
            </label>
          }
          @if (mode() === 'fixed_reserve') {
            <label class="field" for="dst-cr-reserve">
              <span>{{ 'distribution.field.fixedReserve' | translate }}</span>
              <nz-input-number
                nzId="dst-cr-reserve"
                formControlName="fixed_reserve_qty"
                [nzMin]="0"
              ></nz-input-number>
            </label>
          }
          @if (mode() === 'priority_rank') {
            <label class="field" for="dst-cr-rank">
              <span>{{ 'distribution.field.priorityRank' | translate }}</span>
              <nz-input-number
                nzId="dst-cr-rank"
                formControlName="priority_rank"
                [nzMin]="1"
                [nzStep]="1"
              ></nz-input-number>
            </label>
          }
          <label class="field" for="dst-cr-buffer">
            <span>{{ 'distribution.field.safetyBuffer' | translate }}</span>
            <nz-input-number
              nzId="dst-cr-buffer"
              formControlName="safety_buffer_qty"
              [nzMin]="0"
            ></nz-input-number>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.includeInTransit' | translate }}</span>
            <nz-switch formControlName="include_in_transit"></nz-switch>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.excludeConsignment' | translate }}</span>
            <nz-switch formControlName="exclude_consignment"></nz-switch>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.exclude3pl' | translate }}</span>
            <nz-switch formControlName="exclude_3pl"></nz-switch>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.active' | translate }}</span>
            <nz-switch formControlName="is_active"></nz-switch>
          </label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="ruleForm.invalid"
            >
              {{ 'distribution.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="ruleOpen.set(false)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ChannelsComponent implements OnInit {
  protected readonly store = inject(ChannelsStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly channelTypes = DST_CHANNEL_TYPES;
  protected readonly modes = DST_ALLOCATION_MODES;
  protected readonly feedback = signal<DstOutcome | null>(null);
  protected readonly formError = signal<DstOutcome | null>(null);
  protected readonly channelOpen = signal(false);
  protected readonly ruleOpen = signal(false);
  protected readonly editingChannel = signal<DstChannel | null>(null);
  protected readonly editingRule = signal<DstChannelRule | null>(null);
  protected readonly mode = signal<DstAllocationMode>('shared_pool');

  protected readonly channelForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    channel_type: ['ecommerce' as DstChannel['channel_type'], Validators.required],
    priority: [1, Validators.min(1)],
    is_active: [true],
  });

  protected readonly ruleForm = this.fb.group({
    warehouse_id: ['', Validators.required],
    allocation_mode: ['shared_pool' as DstAllocationMode, Validators.required],
    allocation_percentage: [null as number | null],
    fixed_reserve_qty: [null as number | null],
    priority_rank: [null as number | null],
    safety_buffer_qty: [null as number | null],
    include_in_transit: [false],
    exclude_consignment: [true],
    exclude_3pl: [false],
    is_active: [true],
  });

  constructor() {
    this.ruleForm.controls.allocation_mode.valueChanges.subscribe((value) => this.mode.set(value));
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected allocationValue(rule: DstChannelRule): string {
    switch (rule.allocation_mode) {
      case 'percentage':
        return `${formatQuantity(rule.allocation_percentage)}%`;
      case 'fixed_reserve':
        return formatQuantity(rule.fixed_reserve_qty);
      case 'priority_rank':
        return `#${rule.priority_rank ?? '—'}`;
      default:
        return '100%';
    }
  }

  protected openChannel(channel: DstChannel | null): void {
    this.editingChannel.set(channel);
    this.channelForm.reset({
      code: channel?.code ?? '',
      name: channel?.name ?? '',
      channel_type: channel?.channel_type ?? 'ecommerce',
      priority: channel?.priority ?? 1,
      is_active: channel?.is_active ?? true,
    });
    this.formError.set(null);
    this.channelOpen.set(true);
  }

  protected async submitChannel(): Promise<void> {
    const outcome = await this.store.saveChannel(
      this.channelForm.getRawValue(),
      this.editingChannel()?.id,
    );
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
      this.channelOpen.set(false);
    } else {
      this.formError.set(outcome);
    }
  }

  protected async removeChannel(channel: DstChannel): Promise<void> {
    const outcome = await this.store.removeChannel(channel.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected openRule(rule: DstChannelRule | null): void {
    this.editingRule.set(rule);
    this.ruleForm.reset({
      warehouse_id: rule?.warehouse_id ?? '',
      allocation_mode: rule?.allocation_mode ?? 'shared_pool',
      allocation_percentage: numberOrNull(rule?.allocation_percentage),
      fixed_reserve_qty: numberOrNull(rule?.fixed_reserve_qty),
      priority_rank: rule?.priority_rank ?? null,
      safety_buffer_qty: numberOrNull(rule?.safety_buffer_qty),
      include_in_transit: rule?.include_in_transit ?? false,
      exclude_consignment: rule?.exclude_consignment ?? true,
      exclude_3pl: rule?.exclude_3pl ?? false,
      is_active: rule?.is_active ?? true,
    });
    this.mode.set(rule?.allocation_mode ?? 'shared_pool');
    this.formError.set(null);
    this.ruleOpen.set(true);
  }

  protected async submitRule(): Promise<void> {
    const outcome = await this.store.saveRule(this.ruleForm.getRawValue(), this.editingRule()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
      this.ruleOpen.set(false);
    } else {
      this.formError.set(outcome);
    }
  }

  protected async removeRule(rule: DstChannelRule): Promise<void> {
    const outcome = await this.store.removeRule(rule.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
