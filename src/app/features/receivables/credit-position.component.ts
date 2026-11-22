import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AR_OVERRIDE_SCOPES,
  ArCreditLimit,
  ArDecisionOutcome,
  ArOverride,
  ArOverrideScope,
  ArRiskRating,
  PermissionsService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ArCustomerOption, ArCustomerSelectComponent } from './ar-customer-select.component';
import { CreditLimitDrawerComponent, LimitSubmit } from './credit-limit-drawer.component';
import { CreditPositionStore } from './credit-position.store';
import {
  bucketLabelParts,
  outcomeColor,
  parseAmount,
  ratingColor,
  RECEIVABLES_MODULE,
  toIsoDate,
  todayIso,
} from './receivables.util';

const MIN_OVERRIDE_REASON = 5;
const MAX_PERCENT_CENTS = 10000n;

/**
 * Credit limit and block management of one customer (Mod 013): the credit position with its exposure components and
 * risk, the limits over time, the overrides that let a blocked operation through and the provision rates.
 */
@Component({
  selector: 'app-credit-position',
  styleUrl: './receivables.scss',
  providers: [CreditPositionStore],
  imports: [
    ArCustomerSelectComponent,
    CreditLimitDrawerComponent,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'AR.CREDIT_TITLE' | translate" [subtitle]="'AR.CREDIT_SUBTITLE' | translate">
      @if (customerId(); as id) {
        <a nz-button [routerLink]="['/receivables/ledger', id]">{{ 'AR.LEDGER' | translate }}</a>
        <a nz-button [routerLink]="['/receivables/statement', id]">{{ 'AR.STATEMENT' | translate }}</a>
      }
    </app-page-header>

    <div class="toolbar">
      <app-ar-customer-select
        [customerId]="customerId()"
        (customerChange)="onCustomer($event)"
      ></app-ar-customer-select>
    </div>

    @if (!customerId()) {
      <nz-empty [nzNotFoundContent]="'AR.PICK_CUSTOMER_HINT' | translate"></nz-empty>
    } @else {
      @if (store.error(); as error) {
        <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }

      <nz-spin [nzSpinning]="store.loading()">
        @if (store.credit(); as credit) {
          @let money = currency();

          @if (store.isBlocked()) {
            <nz-alert
              class="card"
              nzType="error"
              nzShowIcon
              [nzMessage]="'AR.CUSTOMER_BLOCKED' | translate"
              [nzDescription]="blockDescription"
            ></nz-alert>
          } @else if (store.outcome() === 'warning') {
            <nz-alert
              class="card"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'AR.CUSTOMER_WARNING' | translate"
              [nzDescription]="blockDescription"
            ></nz-alert>
          }
          <ng-template #blockDescription>
            <div>{{ credit.decision.reason }}</div>
            <ul>
              @for (breach of store.breaches(); track breach) {
                <li>{{ 'AR.BREACH_' + breach.toUpperCase() | translate }}</li>
              }
            </ul>
            @if (credit.decision.reaction_policy; as policy) {
              <div>{{ 'AR.REACTION_POLICY' | translate }}: {{ 'AR.POLICY_' + policy.toUpperCase() | translate }}</div>
            }
          </ng-template>

          <div class="summary" role="list">
            <nz-card role="listitem">
              <span class="muted">{{ 'AR.CREDIT_LIMIT' | translate }}</span>
              <span class="figure">
                @if (store.limit(); as limit) {
                  {{ limit.granted_limit | money: limit.currency }}
                } @else {
                  {{ 'AR.NO_LIMIT' | translate }}
                }
              </span>
              @if (store.isCreditHold()) {
                <nz-tag nzColor="red">{{ 'AR.CREDIT_HOLD' | translate }}</nz-tag>
              }
              <nz-tag [nzColor]="outcomeTag(store.outcome())">{{
                'AR.OUTCOME_' + store.outcome().toUpperCase() | translate
              }}</nz-tag>
            </nz-card>

            <nz-card role="listitem">
              <span class="muted">{{ 'AR.TOTAL_EXPOSURE' | translate }}</span>
              <span class="figure">{{ credit.exposure.total_exposure | money: money }}</span>
            </nz-card>

            <nz-card role="listitem">
              <span class="muted">{{ 'AR.AVAILABLE_CREDIT' | translate }}</span>
              <span class="figure" [class.negative]="credit.available_credit?.startsWith('-')">
                @if (credit.available_credit !== null) {
                  {{ credit.available_credit | money: money }}
                } @else {
                  –
                }
              </span>
            </nz-card>

            <nz-card role="listitem">
              <span class="muted">{{ 'AR.UTILIZATION' | translate }}</span>
              @if (store.utilization() !== null) {
                <span class="figure">{{ store.utilization() }}%</span>
                <nz-progress
                  [nzPercent]="progress()"
                  [nzStatus]="store.utilizationStatus()"
                  [nzShowInfo]="false"
                ></nz-progress>
              } @else {
                <span class="figure">–</span>
              }
            </nz-card>

            <nz-card role="listitem">
              <span class="muted">{{ 'AR.INSURED_COVER' | translate }}</span>
              <span class="figure">{{ credit.insured_cover | money: money }}</span>
              <span class="muted">{{ 'AR.UNINSURED_EXPOSURE' | translate }}: {{ credit.uninsured_exposure | money: money }}</span>
            </nz-card>

            <nz-card role="listitem">
              <span class="muted">{{ 'AR.DSO' | translate }}</span>
              <span class="figure">{{ store.dso()?.dso ?? '–' }}</span>
              @if (store.dso(); as dso) {
                <span class="muted">{{ 'AR.DSO_PERIOD' | translate: { days: dso.period_days } }}</span>
              }
            </nz-card>

            @if (store.risk(); as risk) {
              <nz-card role="listitem">
                <span class="muted">{{ 'AR.RISK_SCORE' | translate }}</span>
                <span class="figure">{{ risk.score }}</span>
                <nz-tag [nzColor]="ratingTag(risk.rating)">{{ 'AR.RATING_' + risk.rating.toUpperCase() | translate }}</nz-tag>
              </nz-card>
            }
          </div>

          <div class="grid-2">
            <nz-card class="card" [nzTitle]="'AR.EXPOSURE_COMPONENTS' | translate">
              <table class="matrix">
                <tbody>
                  <tr>
                    <th scope="row">{{ 'AR.OPEN_INVOICES' | translate }}</th>
                    <td class="num">{{ credit.exposure.open_invoices | money: money }}</td>
                  </tr>
                  <tr>
                    <th scope="row">{{ 'AR.UNBILLED_DELIVERY_NOTES' | translate }}</th>
                    <td class="num">{{ credit.exposure.unbilled_delivery_notes | money: money }}</td>
                  </tr>
                  <tr>
                    <th scope="row">{{ 'AR.CONFIRMED_ORDERS' | translate }}</th>
                    <td class="num">{{ credit.exposure.confirmed_orders | money: money }}</td>
                  </tr>
                  <tr>
                    <th scope="row">{{ 'AR.UNRECONCILED_PAYMENTS' | translate }}</th>
                    <td class="num">− {{ credit.exposure.unreconciled_payments | money: money }}</td>
                  </tr>
                  <tr>
                    <th scope="row">{{ 'AR.TOTAL_EXPOSURE' | translate }}</th>
                    <td class="num">
                      <strong>{{ credit.exposure.total_exposure | money: money }}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{{ 'AR.OVERDUE_AMOUNT' | translate }}</th>
                    <td class="num">
                      {{ credit.exposure.overdue_amount | money: money }}
                      <span class="muted">({{ credit.exposure.overdue_items }})</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{{ 'AR.MAX_DAYS_PAST_DUE' | translate }}</th>
                    <td class="num">{{ credit.exposure.max_days_past_due }}</td>
                  </tr>
                </tbody>
              </table>
            </nz-card>

            <nz-card class="card" [nzTitle]="'AR.RISK_FACTORS' | translate">
              @if (store.risk(); as risk) {
                <ul class="factor-list">
                  @for (factor of risk.factors; track factor.key) {
                    <li>
                      <span>{{ 'AR.FACTOR_' + factor.key.toUpperCase() | translate }}</span>
                      <span class="num">{{ factor.value }} · {{ factor.points }} {{ 'AR.POINTS' | translate }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <nz-empty [nzNotFoundContent]="'AR.NO_DATA' | translate"></nz-empty>
              }
            </nz-card>
          </div>

          <nz-card class="card" [nzTitle]="'AR.OVERRIDES' | translate">
            @if (canWrite) {
              <div class="toolbar">
                <button nz-button type="button" (click)="openOverride()">{{ 'AR.GRANT_OVERRIDE' | translate }}</button>
              </div>
            }
            @if (store.activeOverrides().length === 0) {
              <nz-empty [nzNotFoundContent]="'AR.NO_OVERRIDES' | translate"></nz-empty>
            } @else {
              <table class="matrix">
                <thead>
                  <tr>
                    <th scope="col">{{ 'AR.OVERRIDE_SCOPE' | translate }}</th>
                    <th scope="col">{{ 'AR.OVERRIDE_REASON' | translate }}</th>
                    <th scope="col">{{ 'AR.OVERRIDE_EXPIRES' | translate }}</th>
                    <th scope="col">{{ 'AR.ACTIONS' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of store.activeOverrides(); track entry.id) {
                    <tr>
                      <td>{{ 'AR.SCOPE_' + entry.scope.toUpperCase() | translate }}</td>
                      <td>{{ entry.reason }}</td>
                      <td>{{ entry.expires_at ?? '–' }}</td>
                      <td>
                        @if (canWrite) {
                          <button nz-button nzSize="small" nzDanger type="button" (click)="startRevoke(entry)">
                            {{ 'AR.REVOKE' | translate }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </nz-card>

          <nz-card class="card" [nzTitle]="'AR.CREDIT_LIMITS' | translate">
            @if (canWrite) {
              <div class="toolbar">
                <button nz-button nzType="primary" type="button" (click)="openNewLimit()">
                  {{ 'AR.NEW_LIMIT' | translate }}
                </button>
              </div>
            }
            @if (store.limits().length === 0) {
              <nz-empty [nzNotFoundContent]="'AR.NO_LIMIT' | translate"></nz-empty>
            } @else {
              <div class="matrix-wrap">
                <table class="matrix">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'AR.VALID_FROM' | translate }}</th>
                      <th scope="col">{{ 'AR.VALID_TO' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.GRANTED_LIMIT' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.INSURED_LIMIT' | translate }}</th>
                      <th scope="col">{{ 'AR.INSURER' | translate }}</th>
                      <th scope="col">{{ 'AR.REACTION_POLICY' | translate }}</th>
                      <th scope="col">{{ 'AR.STATUS' | translate }}</th>
                      <th scope="col">{{ 'AR.ACTIONS' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of store.limits(); track row.id) {
                      <tr>
                        <td>{{ row.valid_from }}</td>
                        <td>{{ row.valid_to ?? '–' }}</td>
                        <td class="num">{{ row.granted_limit | money: row.currency }}</td>
                        <td class="num">{{ row.insured_limit | money: row.currency }}</td>
                        <td>{{ row.insurer_name ?? '–' }} {{ row.policy_number ?? '' }}</td>
                        <td>{{ 'AR.POLICY_' + row.reaction_policy.toUpperCase() | translate }}</td>
                        <td>
                          @if (row.id === store.limit()?.id) {
                            <nz-tag nzColor="green">{{ 'AR.IN_FORCE' | translate }}</nz-tag>
                          } @else if (!row.is_active) {
                            <nz-tag>{{ 'AR.INACTIVE' | translate }}</nz-tag>
                          }
                        </td>
                        <td>
                          @if (canWrite) {
                            <button nz-button nzSize="small" type="button" (click)="openEditLimit(row)">
                              {{ 'AR.EDIT' | translate }}
                            </button>
                            <button
                              nz-button
                              nzSize="small"
                              nzDanger
                              type="button"
                              nz-popconfirm
                              [nzPopconfirmTitle]="'AR.DELETE_LIMIT_CONFIRM' | translate"
                              (nzOnConfirm)="deleteLimit(row)"
                            >
                              {{ 'AR.DELETE' | translate }}
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </nz-card>

          <nz-card class="card" [nzTitle]="'AR.PROVISION' | translate">
            @if (store.provision(); as provision) {
              @if (canWrite) {
                <div class="toolbar">
                  @if (editingRates()) {
                    <button
                      nz-button
                      nzType="primary"
                      type="button"
                      [disabled]="!ratesValid()"
                      [nzLoading]="store.saving()"
                      (click)="saveRates()"
                    >
                      {{ 'AR.SAVE' | translate }}
                    </button>
                    <button nz-button type="button" (click)="editingRates.set(false)">{{ 'AR.CANCEL' | translate }}</button>
                  } @else {
                    <button nz-button type="button" (click)="startRates()">{{ 'AR.EDIT_RATES' | translate }}</button>
                  }
                </div>
              }
              <table class="matrix">
                <thead>
                  <tr>
                    <th scope="col">{{ 'AR.BUCKET' | translate }}</th>
                    <th scope="col" class="num">{{ 'AR.OPEN_AMOUNT' | translate }}</th>
                    <th scope="col" class="num">{{ 'AR.RATE_PERCENT' | translate }}</th>
                    <th scope="col" class="num">{{ 'AR.PROVISION_AMOUNT' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of provision.lines; track line.key) {
                    @let part = bucketParts(line);
                    <tr>
                      <th scope="row">{{ part.key | translate: part.params }}</th>
                      <td class="num">{{ line.open_amount | money: provision.currency }}</td>
                      <td class="num">
                        @if (editingRates()) {
                          <input
                            nz-input
                            style="width: 90px; text-align: right"
                            inputmode="decimal"
                            [attr.aria-label]="'AR.RATE_PERCENT' | translate"
                            [ngModel]="ratesDraft()[line.key]"
                            (ngModelChange)="setRate(line.key, $event)"
                          />
                        } @else {
                          {{ line.rate_percent }}%
                          @if (line.is_default_rate) {
                            <span class="muted">({{ 'AR.DEFAULT_RATE' | translate }})</span>
                          }
                        }
                      </td>
                      <td class="num">{{ line.provision | money: provision.currency }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{{ 'AR.TOTAL' | translate }}</th>
                    <td class="num">{{ provision.total_open | money: provision.currency }}</td>
                    <td></td>
                    <td class="num">{{ provision.total_provision | money: provision.currency }}</td>
                  </tr>
                  <tr>
                    <th scope="row" colspan="3">{{ 'AR.NET_REALIZABLE_VALUE' | translate }}</th>
                    <td class="num">{{ provision.net_realizable_value | money: provision.currency }}</td>
                  </tr>
                </tfoot>
              </table>
            } @else {
              <nz-empty [nzNotFoundContent]="'AR.NO_DATA' | translate"></nz-empty>
            }
          </nz-card>
        }
      </nz-spin>

      <app-credit-limit-drawer
        [(open)]="limitDrawerOpen"
        [customerId]="customerId() ?? ''"
        [limit]="editingLimit()"
        [currency]="currency()"
        [saving]="store.saving()"
        [serverErrors]="limitErrors()"
        [serverMessage]="limitMessage()"
        (submitted)="onLimitSubmit($event)"
      ></app-credit-limit-drawer>

      <nz-modal
        [nzVisible]="overrideOpen()"
        [nzTitle]="'AR.GRANT_OVERRIDE' | translate"
        [nzOkText]="'AR.GRANT_OVERRIDE' | translate"
        [nzCancelText]="'AR.CANCEL' | translate"
        [nzOkDisabled]="!overrideValid()"
        [nzOkLoading]="store.saving()"
        (nzOnCancel)="overrideOpen.set(false)"
        (nzOnOk)="grantOverride()"
      >
        <ng-container *nzModalContent>
          <div class="field">
            <label for="ov-scope">{{ 'AR.OVERRIDE_SCOPE' | translate }}</label>
            <nz-select
              nzId="ov-scope"
              style="width: 100%"
              [ngModel]="overrideScope()"
              (ngModelChange)="overrideScope.set($event)"
            >
              @for (scope of scopes; track scope) {
                <nz-option [nzValue]="scope" [nzLabel]="'AR.SCOPE_' + scope.toUpperCase() | translate"></nz-option>
              }
            </nz-select>
          </div>
          <div class="field">
            <label for="ov-reason">{{ 'AR.OVERRIDE_REASON' | translate }}</label>
            <textarea
              nz-input
              id="ov-reason"
              rows="3"
              [ngModel]="overrideReason()"
              (ngModelChange)="overrideReason.set($event)"
            ></textarea>
            <span class="muted">{{ 'AR.OVERRIDE_REASON_HINT' | translate: { min: minReason } }}</span>
          </div>
          <div class="field">
            <label for="ov-expires">{{ 'AR.OVERRIDE_EXPIRES' | translate }}</label>
            <nz-date-picker
              nzId="ov-expires"
              style="width: 100%"
              [ngModel]="overrideExpires()"
              (ngModelChange)="overrideExpires.set($event)"
            ></nz-date-picker>
            @if (overrideExpiryInvalid()) {
              <span class="error" role="alert">{{ 'AR.ERR_EXPIRY_PAST' | translate }}</span>
            }
          </div>
          @if (overrideError(); as error) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="error"></nz-alert>
          }
        </ng-container>
      </nz-modal>

      <nz-modal
        [nzVisible]="revokeTarget() !== null"
        [nzTitle]="'AR.REVOKE' | translate"
        [nzOkText]="'AR.REVOKE' | translate"
        [nzCancelText]="'AR.CANCEL' | translate"
        [nzOkLoading]="store.saving()"
        (nzOnCancel)="revokeTarget.set(null)"
        (nzOnOk)="confirmRevoke()"
      >
        <ng-container *nzModalContent>
          <div class="field">
            <label for="rv-reason">{{ 'AR.REVOKE_REASON' | translate }}</label>
            <textarea
              nz-input
              id="rv-reason"
              rows="3"
              [ngModel]="revokeReason()"
              (ngModelChange)="revokeReason.set($event)"
            ></textarea>
          </div>
        </ng-container>
      </nz-modal>
    }
  `,
})
export class CreditPositionComponent implements OnInit {
  readonly store = inject(CreditPositionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Only credit managers write; the others see the position. */
  readonly canWrite = inject(PermissionsService).canWrite(RECEIVABLES_MODULE);

  readonly scopes = AR_OVERRIDE_SCOPES;
  readonly minReason = MIN_OVERRIDE_REASON;
  readonly customerId = signal<string | null>(null);

  readonly currency = computed(
    () =>
      this.store.limit()?.currency ??
      this.store.provision()?.currency ??
      this.store.dso()?.currency ??
      'EUR',
  );
  /** Bar of the utilisation, capped at 100 (the figure next to it is not). Display only. */
  readonly progress = computed(() => Math.max(0, Math.min(100, this.store.utilization() ?? 0)));

  // Limit drawer
  readonly limitDrawerOpen = signal(false);
  readonly editingLimit = signal<ArCreditLimit | null>(null);
  readonly limitErrors = signal<Record<string, string[]>>({});
  readonly limitMessage = signal<string | null>(null);

  // Override grant and revoke
  readonly overrideOpen = signal(false);
  readonly overrideScope = signal<ArOverrideScope>('order');
  readonly overrideReason = signal('');
  readonly overrideExpires = signal<Date | null>(null);
  readonly overrideError = signal<string | null>(null);
  readonly overrideExpiryInvalid = computed(() => {
    const expires = toIsoDate(this.overrideExpires());
    return expires !== null && expires <= todayIso();
  });
  readonly overrideValid = computed(
    () => this.overrideReason().trim().length >= MIN_OVERRIDE_REASON && !this.overrideExpiryInvalid(),
  );
  readonly revokeTarget = signal<ArOverride | null>(null);
  readonly revokeReason = signal('');

  // Provision rates
  readonly editingRates = signal(false);
  readonly ratesDraft = signal<Record<string, string>>({});
  readonly ratesValid = computed(() => {
    const lines = this.store.provision()?.lines ?? [];
    return (
      lines.length > 0 &&
      lines.every((line) => {
        const cents = parseAmount((this.ratesDraft()[line.key] ?? '').trim());
        return cents !== null && cents >= 0n && cents <= MAX_PERCENT_CENTS;
      })
    );
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('customerId');
      this.customerId.set(id);
      this.editingRates.set(false);
      if (id) {
        void this.store.load(id);
      }
    });
  }

  outcomeTag(outcome: ArDecisionOutcome): string {
    return outcomeColor(outcome);
  }

  ratingTag(rating: ArRiskRating): string {
    return ratingColor(rating);
  }

  bucketParts(line: { key: string; from: number | null; to: number | null }): {
    key: string;
    params?: Record<string, number>;
  } {
    return bucketLabelParts(line);
  }

  onCustomer(option: ArCustomerOption | null): void {
    void this.router.navigate(option ? ['/receivables/credit', option.id] : ['/receivables/credit']);
  }

  // --- Limits ---

  openNewLimit(): void {
    this.editingLimit.set(null);
    this.resetLimitFeedback();
    this.limitDrawerOpen.set(true);
  }

  openEditLimit(limit: ArCreditLimit): void {
    this.editingLimit.set(limit);
    this.resetLimitFeedback();
    this.limitDrawerOpen.set(true);
  }

  async onLimitSubmit(event: LimitSubmit): Promise<void> {
    this.resetLimitFeedback();
    const outcome = await this.store.saveLimit(event.id, event.payload);
    if (outcome.ok) {
      this.limitDrawerOpen.set(false);
      this.message.success(this.translate.instant('AR.LIMIT_SAVED'));
    } else {
      this.limitErrors.set(outcome.errors);
      this.limitMessage.set(
        Object.keys(outcome.errors).length > 0 ? null : (outcome.message ?? this.translate.instant('AR.SAVE_ERROR')),
      );
    }
  }

  async deleteLimit(limit: ArCreditLimit): Promise<void> {
    const outcome = await this.store.deleteLimit(limit.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('AR.LIMIT_DELETED'));
    } else {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  // --- Overrides ---

  openOverride(): void {
    this.overrideScope.set('order');
    this.overrideReason.set('');
    this.overrideExpires.set(null);
    this.overrideError.set(null);
    this.overrideOpen.set(true);
  }

  async grantOverride(): Promise<void> {
    if (!this.overrideValid()) {
      return;
    }
    const expires = toIsoDate(this.overrideExpires());
    const outcome = await this.store.grantOverride({
      scope: this.overrideScope(),
      reason: this.overrideReason().trim(),
      ...(expires ? { expires_at: expires } : {}),
    });
    if (outcome.ok) {
      this.overrideOpen.set(false);
      this.message.success(this.translate.instant('AR.OVERRIDE_GRANTED'));
    } else {
      this.overrideError.set(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  startRevoke(entry: ArOverride): void {
    this.revokeReason.set('');
    this.revokeTarget.set(entry);
  }

  async confirmRevoke(): Promise<void> {
    const target = this.revokeTarget();
    if (!target) {
      return;
    }
    const reason = this.revokeReason().trim();
    const outcome = await this.store.revokeOverride(target.id, reason || undefined);
    if (outcome.ok) {
      this.revokeTarget.set(null);
      this.message.success(this.translate.instant('AR.OVERRIDE_REVOKED'));
    } else {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  // --- Provision rates ---

  startRates(): void {
    const draft: Record<string, string> = {};
    for (const line of this.store.provision()?.lines ?? []) {
      draft[line.key] = line.rate_percent;
    }
    this.ratesDraft.set(draft);
    this.editingRates.set(true);
  }

  setRate(key: string, value: string): void {
    this.ratesDraft.update((draft) => ({ ...draft, [key]: value }));
  }

  async saveRates(): Promise<void> {
    if (!this.ratesValid()) {
      return;
    }
    const rates = Object.fromEntries(
      Object.entries(this.ratesDraft()).map(([key, value]) => [key, Number(value.trim())]),
    );
    const outcome = await this.store.saveProvisionRates(rates);
    if (outcome.ok) {
      this.editingRates.set(false);
      this.message.success(this.translate.instant('AR.RATES_SAVED'));
    } else {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  private resetLimitFeedback(): void {
    this.limitErrors.set({});
    this.limitMessage.set(null);
  }
}
