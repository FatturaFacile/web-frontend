import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { I18nService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ProjectBillingApiService } from './project-billing-api.service';
import { BillingContract, RetainerState, RetentionBalance } from './project-billing.models';
import { modelSupports, retainerBurnPercent } from './project-billing.utils';

/**
 * Prepaid retainer burn-down and guarantee retention of a project (Mod 081): the hour bank with its low-balance alert,
 * top-up and consumption, and the retention held with its full or partial release.
 */
@Component({
  selector: 'app-retainer-retention',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzInputNumberModule,
    NzProgressModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    @if (usesRetainer()) {
      <nz-card
        nzSize="small"
        [nzTitle]="'PROJECT_BILLING.RETAINER_TITLE' | translate"
        class="bf-card"
      >
        @if (retainer(); as state) {
          <nz-progress
            data-testid="retainer-bar"
            [nzPercent]="burn()"
            [nzStatus]="state.balance.is_low_balance ? 'exception' : 'normal'"
            [nzFormat]="burnFormat"
          />
          <p data-testid="retainer-remaining">
            @if (state.balance.unit === 'hours') {
              {{
                'PROJECT_BILLING.RETAINER_REMAINING_HOURS'
                  | translate: { hours: state.balance.remaining_hours }
              }}
            } @else {
              {{ 'PROJECT_BILLING.RETAINER_REMAINING_AMOUNT' | translate }}:
              {{ state.balance.remaining_amount | money: currency() }}
            }
          </p>
          @if (state.balance.is_low_balance) {
            <nz-alert
              nzType="warning"
              nzShowIcon
              data-testid="retainer-low"
              [nzMessage]="
                'PROJECT_BILLING.RETAINER_LOW'
                  | translate: { threshold: state.balance.low_balance_threshold_percent }
              "
            />
          }
          @if (canWrite()) {
            <div class="bf-actions">
              <nz-input-number
                data-testid="topup-hours"
                [nzMin]="0"
                [ngModel]="topUpHours()"
                (ngModelChange)="topUpHours.set($event)"
                [nzPlaceHolder]="'PROJECT_BILLING.TOPUP_HOURS' | translate"
              />
              <nz-input-number
                [nzMin]="0"
                [ngModel]="topUpAmount()"
                (ngModelChange)="topUpAmount.set($event)"
                [nzPlaceHolder]="'PROJECT_BILLING.TOPUP_AMOUNT' | translate"
              />
              <button
                nz-button
                nzType="primary"
                type="button"
                data-testid="topup-save"
                [disabled]="!topUpValid()"
                (click)="topUp()"
              >
                {{ 'PROJECT_BILLING.TOPUP' | translate }}
              </button>
              <button nz-button type="button" data-testid="retainer-consume" (click)="consume()">
                {{ 'PROJECT_BILLING.RETAINER_CONSUME' | translate }}
              </button>
            </div>
          }
          <nz-table
            nzSize="small"
            [nzData]="state.entries"
            [nzShowPagination]="false"
            data-testid="retainer-entries"
          >
            <thead>
              <tr>
                <th>{{ 'PROJECT_BILLING.COL_DATE' | translate }}</th>
                <th>{{ 'PROJECT_BILLING.COL_TYPE' | translate }}</th>
                <th class="bf-num">{{ 'PROJECT_BILLING.COL_HOURS' | translate }}</th>
                <th class="bf-num">{{ 'PROJECT_BILLING.COL_AMOUNT' | translate }}</th>
                <th class="bf-num">{{ 'PROJECT_BILLING.COL_BALANCE' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of state.entries; track entry.id) {
                <tr>
                  <td>{{ entry.entry_date }}</td>
                  <td>
                    {{
                      (entry.entry_type === 'top_up'
                        ? 'PROJECT_BILLING.ENTRY_TOP_UP'
                        : 'PROJECT_BILLING.ENTRY_CONSUMPTION'
                      ) | translate
                    }}
                  </td>
                  <td class="bf-num">{{ entry.hours }}</td>
                  <td class="bf-num">{{ entry.amount | money: currency() }}</td>
                  <td class="bf-num">{{ entry.balance_hours_after }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-card>
    }

    <nz-card
      nzSize="small"
      [nzTitle]="'PROJECT_BILLING.RETENTION_TITLE' | translate"
      class="bf-card"
    >
      @if (retention(); as held) {
        <p data-testid="retention-balance">
          {{ 'PROJECT_BILLING.RETENTION_HELD' | translate }}:
          <strong>{{ held.balance | money: currency() }}</strong>
          <span class="bf-muted">
            ({{ 'PROJECT_BILLING.RETENTION_WITHHELD' | translate }}
            {{ held.withheld | money: currency() }},
            {{ 'PROJECT_BILLING.RETENTION_RELEASED' | translate }}
            {{ held.released | money: currency() }})</span
          >
        </p>
        @if (canWrite() && held.balance !== '0.00') {
          <div class="bf-actions">
            <nz-input-number
              data-testid="release-amount"
              [nzMin]="0"
              [ngModel]="releaseAmount()"
              (ngModelChange)="releaseAmount.set($event)"
              [nzPlaceHolder]="'PROJECT_BILLING.RELEASE_FULL' | translate"
            />
            @if (held.release_rule === 'on_acceptance') {
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label
                nz-checkbox
                data-testid="release-acceptance"
                [ngModel]="acceptance()"
                (ngModelChange)="acceptance.set($event)"
                >{{ 'PROJECT_BILLING.ACCEPTANCE_CONFIRMED' | translate }}</label
              >
            }
            <button
              nz-button
              nzType="primary"
              type="button"
              data-testid="release-save"
              (click)="release()"
            >
              {{ 'PROJECT_BILLING.RELEASE' | translate }}
            </button>
          </div>
        }
      } @else {
        <p class="bf-muted">{{ 'PROJECT_BILLING.RETENTION_NONE' | translate }}</p>
      }
    </nz-card>
  `,
})
export class RetainerRetentionComponent {
  private readonly api = inject(ProjectBillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly projectId = input.required<string>();
  readonly contract = input<BillingContract | null>(null);
  readonly retainer = input<RetainerState | null>(null);
  readonly retention = input<RetentionBalance | null>(null);
  readonly currency = input('EUR');
  readonly canWrite = input(false);
  readonly changed = output<void>();

  protected readonly topUpHours = signal<number | null>(null);
  protected readonly topUpAmount = signal<number | null>(null);
  protected readonly releaseAmount = signal<number | null>(null);
  protected readonly acceptance = signal(false);
  protected readonly usesRetainer = computed(() =>
    modelSupports(this.contract()?.billing_model ?? null, 'retainer'),
  );
  protected readonly burn = computed(() => retainerBurnPercent(this.retainer()?.balance ?? null));
  protected readonly topUpValid = computed(
    () => (this.topUpHours() ?? 0) > 0 || (this.topUpAmount() ?? 0) > 0,
  );
  protected readonly burnFormat = (percent: number): string => `${percent}%`;

  protected topUp(): void {
    this.api
      .topUpRetainer(this.projectId(), { hours: this.topUpHours(), amount: this.topUpAmount() })
      .subscribe({
        next: () => {
          this.topUpHours.set(null);
          this.topUpAmount.set(null);
          this.changed.emit();
        },
        error: () => this.fail(),
      });
  }

  protected consume(): void {
    this.api
      .consumeRetainer(this.projectId(), new Date().toISOString().slice(0, 10))
      .subscribe({ next: () => this.changed.emit(), error: () => this.fail() });
  }

  protected release(): void {
    this.api
      .releaseRetention(this.projectId(), {
        amount: this.releaseAmount(),
        acceptance_confirmed: this.acceptance(),
      })
      .subscribe({
        next: () => {
          this.releaseAmount.set(null);
          this.message.success(this.i18n.translate('PROJECT_BILLING.RELEASED'));
          this.changed.emit();
        },
        error: () => this.fail(),
      });
  }

  private fail(): void {
    this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
  }
}
