import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  LpJurisdiction,
  LpManualItem,
  LpManualItemPayload,
  LpSettings,
  TranslateService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { LiquidityPlanningStore, LpOutcome } from './liquidity-planning.store';
import {
  emptyManualItem,
  LP_FREQUENCIES,
  LP_ITEM_CATEGORIES,
  LP_TIERS,
  todayIso,
} from './liquidity-planning.util';

type DecimalSetting =
  | 'share_capital'
  | 'legal_minimum_capital'
  | 'minimum_liquidity'
  | 'dscr_critical_threshold'
  | 'dscr_warning_threshold'
  | 'max_pfn_ebitda';
type NullableSetting =
  'ebitda_override' | 'net_equity_override' | 'payroll_monthly_override' | 'tax_monthly_estimate';
type IntegerSetting = 'alert_cooldown_hours' | 'collection_behavior_days' | 'payroll_pay_day';

const DECIMAL_SETTINGS: readonly DecimalSetting[] = [
  'share_capital',
  'legal_minimum_capital',
  'minimum_liquidity',
  'dscr_critical_threshold',
  'dscr_warning_threshold',
  'max_pfn_ebitda',
];
const NULLABLE_SETTINGS: readonly NullableSetting[] = [
  'ebitda_override',
  'net_equity_override',
  'payroll_monthly_override',
  'tax_monthly_estimate',
];
const INTEGER_SETTINGS: readonly IntegerSetting[] = [
  'alert_cooldown_hours',
  'collection_behavior_days',
  'payroll_pay_day',
];

/** Planning data of the CFO: the thresholds and assumptions of the plan, and the manual forecast items. */
@Component({
  selector: 'app-lp-planning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    <nz-card [nzTitle]="'lp.settings.title' | translate" data-testid="lp-settings">
      @if (draft(); as settings) {
        <div class="lp-form-grid">
          <div class="lp-field">
            <label for="lp-jurisdiction">{{ 'lp.settings.jurisdiction' | translate }}</label>
            <nz-select
              nzId="lp-jurisdiction"
              [ngModel]="settings.jurisdiction"
              (ngModelChange)="patchSettings({ jurisdiction: $event })"
            >
              @for (code of jurisdictions; track code) {
                <nz-option
                  [nzValue]="code"
                  [nzLabel]="'lp.settings.jurisdictionValue.' + code | translate"
                />
              }
            </nz-select>
          </div>

          @for (key of decimalKeys; track key) {
            <div class="lp-field">
              <label [for]="'lp-set-' + key">{{ 'lp.settings.' + key | translate }}</label>
              <input
                nz-input
                [id]="'lp-set-' + key"
                inputmode="decimal"
                [ngModel]="settings[key]"
                (ngModelChange)="setField(key, $event)"
              />
            </div>
          }

          @for (key of nullableKeys; track key) {
            <div class="lp-field">
              <label [for]="'lp-set-' + key">{{ 'lp.settings.' + key | translate }}</label>
              <input
                nz-input
                [id]="'lp-set-' + key"
                inputmode="decimal"
                [ngModel]="settings[key] ?? ''"
                (ngModelChange)="setField(key, $event === '' ? null : $event)"
              />
            </div>
          }

          @for (key of integerKeys; track key) {
            <div class="lp-field">
              <label [for]="'lp-set-' + key">{{ 'lp.settings.' + key | translate }}</label>
              <input
                nz-input
                [id]="'lp-set-' + key"
                type="number"
                [ngModel]="settings[key]"
                (ngModelChange)="setField(key, toInt($event))"
              />
            </div>
          }

          <div class="lp-field">
            <label for="lp-set-emails">{{ 'lp.settings.notify_emails' | translate }}</label>
            <input
              nz-input
              id="lp-set-emails"
              [ngModel]="settings.notify_emails.join(', ')"
              (ngModelChange)="patchSettings({ notify_emails: splitEmails($event) })"
            />
          </div>

          <div class="lp-field">
            <span>{{ 'lp.settings.email_alerts_enabled' | translate }}</span>
            <nz-switch
              [ngModel]="settings.email_alerts_enabled"
              (ngModelChange)="patchSettings({ email_alerts_enabled: $event })"
            />
          </div>
        </div>
        <button
          nz-button
          nzType="primary"
          [nzLoading]="store.saving()"
          data-testid="lp-save-settings"
          (click)="saveSettings()"
        >
          {{ 'lp.settings.save' | translate }}
        </button>
      }
    </nz-card>

    <nz-card
      class="lp-lines"
      [nzTitle]="'lp.items.title' | translate"
      [nzExtra]="addAction"
      data-testid="lp-items"
    >
      <ng-template #addAction>
        <button
          nz-button
          nzType="primary"
          nzSize="small"
          data-testid="lp-add-item"
          (click)="openDrawer(null)"
        >
          {{ 'lp.items.add' | translate }}
        </button>
      </ng-template>

      @if (store.manualItems().length === 0) {
        <nz-empty [nzNotFoundContent]="'lp.items.empty' | translate" />
      } @else {
        <nz-table
          #itemTable
          nzSize="small"
          [nzData]="store.manualItems()"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'lp.items.col.label' | translate }}</th>
              <th>{{ 'lp.items.col.tier' | translate }}</th>
              <th>{{ 'lp.items.col.category' | translate }}</th>
              <th>{{ 'lp.items.col.direction' | translate }}</th>
              <th class="lp-num">{{ 'lp.items.col.amount' | translate }}</th>
              <th>{{ 'lp.items.col.when' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of itemTable.data; track item.id) {
              <tr [class.lp-muted]="!item.is_active">
                <td>{{ item.label }}</td>
                <td>{{ 'lp.tier.' + item.tier | translate }}</td>
                <td>{{ 'lpApi.category.' + item.category | translate }}</td>
                <td>{{ 'lp.items.direction.' + item.direction | translate }}</td>
                <td class="lp-num">{{ item.amount | money: item.currency }}</td>
                <td>
                  {{ item.first_date }} · {{ 'lp.items.frequency.' + item.frequency | translate }}
                </td>
                <td class="lp-actions">
                  <button nz-button nzSize="small" (click)="openDrawer(item)">
                    {{ 'lp.items.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    nz-popconfirm
                    [nzPopconfirmTitle]="'lp.items.deleteConfirm' | translate"
                    (nzOnConfirm)="remove(item.id)"
                  >
                    {{ 'lp.items.delete' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="440"
      [nzTitle]="'lp.items.formTitle' | translate"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (item(); as form) {
          <div class="lp-form-stack" data-testid="lp-item-form">
            <label for="lp-item-label">{{ 'lp.items.col.label' | translate }}</label>
            <input
              nz-input
              id="lp-item-label"
              maxlength="160"
              [ngModel]="form.label"
              (ngModelChange)="patchItem({ label: $event })"
            />

            <label for="lp-item-tier">{{ 'lp.items.col.tier' | translate }}</label>
            <nz-select
              nzId="lp-item-tier"
              [ngModel]="form.tier"
              (ngModelChange)="patchItem({ tier: $event })"
            >
              @for (tier of tiers; track tier) {
                <nz-option [nzValue]="tier" [nzLabel]="'lp.tier.' + tier | translate" />
              }
            </nz-select>

            <label for="lp-item-category">{{ 'lp.items.col.category' | translate }}</label>
            <nz-select
              nzId="lp-item-category"
              [ngModel]="form.category"
              (ngModelChange)="patchItem({ category: $event })"
            >
              @for (category of categories; track category) {
                <nz-option
                  [nzValue]="category"
                  [nzLabel]="'lpApi.category.' + category | translate"
                />
              }
            </nz-select>

            <label for="lp-item-direction">{{ 'lp.items.col.direction' | translate }}</label>
            <nz-select
              nzId="lp-item-direction"
              [ngModel]="form.direction"
              (ngModelChange)="patchItem({ direction: $event })"
            >
              <nz-option nzValue="inflow" [nzLabel]="'lp.items.direction.inflow' | translate" />
              <nz-option nzValue="outflow" [nzLabel]="'lp.items.direction.outflow' | translate" />
            </nz-select>

            <label for="lp-item-amount">{{ 'lp.items.col.amount' | translate }}</label>
            <input
              nz-input
              id="lp-item-amount"
              inputmode="decimal"
              [ngModel]="form.amount"
              (ngModelChange)="patchItem({ amount: $event })"
            />

            <label for="lp-item-currency">{{ 'lp.items.currency' | translate }}</label>
            <input
              nz-input
              id="lp-item-currency"
              maxlength="3"
              [ngModel]="form.currency"
              (ngModelChange)="patchItem({ currency: ($event ?? '').toUpperCase() })"
            />

            <label for="lp-item-date">{{ 'lp.items.firstDate' | translate }}</label>
            <input
              nz-input
              id="lp-item-date"
              type="date"
              [ngModel]="form.first_date"
              (ngModelChange)="patchItem({ first_date: $event })"
            />

            <label for="lp-item-frequency">{{ 'lp.items.col.frequency' | translate }}</label>
            <nz-select
              nzId="lp-item-frequency"
              [ngModel]="form.frequency"
              (ngModelChange)="patchItem({ frequency: $event })"
            >
              @for (frequency of frequencies; track frequency) {
                <nz-option
                  [nzValue]="frequency"
                  [nzLabel]="'lp.items.frequency.' + frequency | translate"
                />
              }
            </nz-select>

            <label for="lp-item-end">{{ 'lp.items.endDate' | translate }}</label>
            <input
              nz-input
              id="lp-item-end"
              type="date"
              [ngModel]="form.end_date ?? ''"
              (ngModelChange)="patchItem({ end_date: $event || null })"
            />

            <label for="lp-item-notes">{{ 'lp.items.notes' | translate }}</label>
            <textarea
              nz-input
              id="lp-item-notes"
              rows="3"
              [ngModel]="form.notes ?? ''"
              (ngModelChange)="patchItem({ notes: $event || null })"
            ></textarea>

            <span>{{ 'lp.items.active' | translate }}</span>
            <nz-switch
              [ngModel]="form.is_active"
              (ngModelChange)="patchItem({ is_active: $event })"
            />

            <div class="lp-actions">
              <button
                nz-button
                nzType="primary"
                [nzLoading]="store.saving()"
                data-testid="lp-save-item"
                (click)="saveItem()"
              >
                {{ 'lp.items.save' | translate }}
              </button>
              <button nz-button (click)="drawerOpen.set(false)">
                {{ 'lp.items.cancel' | translate }}
              </button>
            </div>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class LpPlanningComponent {
  protected readonly store = inject(LiquidityPlanningStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly jurisdictions: readonly LpJurisdiction[] = ['CH', 'IT'];
  protected readonly tiers = LP_TIERS;
  protected readonly categories = LP_ITEM_CATEGORIES;
  protected readonly frequencies = LP_FREQUENCIES;
  protected readonly decimalKeys = DECIMAL_SETTINGS;
  protected readonly nullableKeys = NULLABLE_SETTINGS;
  protected readonly integerKeys = INTEGER_SETTINGS;

  protected readonly draft = signal<LpSettings | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly item = signal<LpManualItemPayload | null>(null);
  private readonly currency = computed(() => this.store.currency());

  constructor() {
    effect(() => {
      const settings = this.store.settings();

      if (settings !== null) {
        this.draft.set({ ...settings });
      }
    });
  }

  protected patchSettings(patch: Partial<LpSettings>): void {
    this.draft.update((current) => (current === null ? current : { ...current, ...patch }));
  }

  protected setField(
    key: DecimalSetting | NullableSetting | IntegerSetting,
    value: string | number | null,
  ): void {
    this.draft.update((current) => (current === null ? current : { ...current, [key]: value }));
  }

  protected toInt(value: unknown): number {
    const parsed = Number.parseInt(String(value), 10);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  protected splitEmails(value: string): string[] {
    return value
      .split(/[,;\s]+/)
      .map((email) => email.trim())
      .filter((email) => email !== '');
  }

  protected async saveSettings(): Promise<void> {
    const settings = this.draft();

    if (settings !== null) {
      this.report(await this.store.saveSettings(settings), 'lp.settings.saved');
    }
  }

  protected openDrawer(existing: LpManualItem | null): void {
    this.editingId.set(existing?.id ?? null);
    this.item.set(
      existing === null
        ? emptyManualItem(todayIso(), this.currency())
        : {
            label: existing.label,
            tier: existing.tier,
            category: existing.category,
            direction: existing.direction,
            amount: existing.amount,
            currency: existing.currency,
            first_date: existing.first_date,
            frequency: existing.frequency,
            end_date: existing.end_date,
            is_active: existing.is_active,
            notes: existing.notes,
          },
    );
    this.drawerOpen.set(true);
  }

  protected patchItem(patch: Partial<LpManualItemPayload>): void {
    this.item.update((current) => (current === null ? current : { ...current, ...patch }));
  }

  protected async saveItem(): Promise<void> {
    const payload = this.item();

    if (payload === null) {
      return;
    }

    const outcome = await this.store.saveManualItem(this.editingId(), payload);

    if (outcome.ok) {
      this.drawerOpen.set(false);
    }
    this.report(outcome, 'lp.items.saved');
  }

  protected async remove(id: string): Promise<void> {
    this.report(await this.store.deleteManualItem(id), 'lp.items.deleted');
  }

  private report(outcome: LpOutcome, successKey: string): void {
    if (outcome.ok) {
      this.message.success(this.i18n.translate(successKey));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'lp.error.generic'));
    }
  }
}
