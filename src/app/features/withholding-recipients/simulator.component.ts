import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { WR_ACTIVITY_TYPES, WR_ENASARCO_MANDATES, WR_REGIMES } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { SimulationResultComponent } from './simulation-result.component';
import { SimulatorStore } from './simulator.store';
import {
  declaresThirdPartyIncome,
  isAgentRegime,
  isSwissRegime,
} from './withholding-recipients.util';

/**
 * Fee-note and compensation simulator (Mod 356): the calculation of a payment to a registered recipient, or to ad-hoc facts,
 * re-run a moment after every change: flat-rate deduction, withholdings, contributions, net payable and cost for the company.
 */
@Component({
  selector: 'app-wr-simulator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    SimulationResultComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSpinModule,
  ],
  providers: [SimulatorStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.WITHHOLDING_RECIPIENTS_SIMULATOR' | translate"
    ></app-page-header>

    <div class="layout">
      <nz-card [nzTitle]="'withholdingRecipients.simulator.facts' | translate">
        <div class="grid">
          <label class="field wide" for="wr-sim-recipient">
            <span>{{ 'withholdingRecipients.simulator.recipient' | translate }}</span>
            <nz-select
              nzId="wr-sim-recipient"
              nzAllowClear
              nzShowSearch
              [nzPlaceHolder]="'withholdingRecipients.simulator.adHoc' | translate"
              [ngModel]="store.form().recipient_profile_id"
              (ngModelChange)="store.pickRecipient($event ?? null)"
            >
              @for (entry of store.recipients(); track entry.id) {
                <nz-option [nzValue]="entry.id" [nzLabel]="entry.display_name"></nz-option>
              }
            </nz-select>
          </label>

          @if (store.recipient(); as picked) {
            <p class="hint wide">
              {{ 'withholdingRecipients.regime.' + picked.regime | translate }}
            </p>
          } @else {
            <label class="field wide" for="wr-sim-regime">
              <span>{{ 'withholdingRecipients.field.regime' | translate }}</span>
              <nz-select
                nzId="wr-sim-regime"
                [ngModel]="store.form().regime"
                (ngModelChange)="store.patch({ regime: $event })"
              >
                @for (regime of regimes; track regime) {
                  <nz-option
                    [nzValue]="regime"
                    [nzLabel]="'withholdingRecipients.regime.' + regime | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
          }

          <label class="field" for="wr-sim-gross">
            <span>{{ 'withholdingRecipients.field.grossAmount' | translate }}</span>
            <nz-input-number
              nzId="wr-sim-gross"
              [nzMin]="0"
              [nzStep]="100"
              [ngModel]="store.form().gross_amount"
              (ngModelChange)="store.patch({ gross_amount: $event })"
            ></nz-input-number>
          </label>
          <label class="field" for="wr-sim-payment">
            <span>{{ 'withholdingRecipients.field.paymentDate' | translate }}</span>
            <input
              nz-input
              id="wr-sim-payment"
              type="date"
              [ngModel]="store.form().payment_date"
              (ngModelChange)="store.patch({ payment_date: $event })"
            />
          </label>
          <label class="field" for="wr-sim-service">
            <span>{{ 'withholdingRecipients.field.serviceDate' | translate }}</span>
            <input
              nz-input
              id="wr-sim-service"
              type="date"
              [ngModel]="store.form().service_date"
              (ngModelChange)="store.patch({ service_date: $event })"
            />
          </label>

          @if (store.regime() === 'swiss_foreign_artist') {
            <label class="field" for="wr-sim-days">
              <span>{{ 'withholdingRecipients.field.performanceDays' | translate }}</span>
              <nz-input-number
                nzId="wr-sim-days"
                [nzMin]="1"
                [nzMax]="366"
                [ngModel]="store.form().performance_days"
                (ngModelChange)="store.patch({ performance_days: $event })"
              ></nz-input-number>
            </label>
            <label class="field" for="wr-sim-expenses">
              <span>{{ 'withholdingRecipients.field.acquisitionExpenses' | translate }}</span>
              <nz-input-number
                nzId="wr-sim-expenses"
                [nzMin]="0"
                [ngModel]="store.form().acquisition_expenses"
                (ngModelChange)="store.patch({ acquisition_expenses: $event })"
              ></nz-input-number>
            </label>
          }
        </div>

        @if (!store.recipient()) {
          <h4 class="title">{{ 'withholdingRecipients.simulator.adHocFacts' | translate }}</h4>
          <div class="grid">
            @if (!swiss()) {
              <label class="field" for="wr-sim-tax-code">
                <span>{{ 'withholdingRecipients.field.taxCode' | translate }}</span>
                <input
                  nz-input
                  id="wr-sim-tax-code"
                  maxlength="20"
                  [ngModel]="store.form().tax_code"
                  (ngModelChange)="store.patch({ tax_code: $event })"
                />
              </label>
              <label class="field" for="wr-sim-birth">
                <span>{{ 'withholdingRecipients.field.birthDate' | translate }}</span>
                <input
                  nz-input
                  id="wr-sim-birth"
                  type="date"
                  [ngModel]="store.form().birth_date"
                  (ngModelChange)="store.patch({ birth_date: $event })"
                />
              </label>
            } @else {
              <label class="field" for="wr-sim-canton">
                <span>{{ 'withholdingRecipients.field.canton' | translate }}</span>
                <input
                  nz-input
                  id="wr-sim-canton"
                  maxlength="2"
                  [ngModel]="store.form().canton"
                  (ngModelChange)="store.patch({ canton: $event })"
                />
              </label>
            }

            @if (agent()) {
              <label class="field" for="wr-sim-mandate">
                <span>{{ 'withholdingRecipients.field.enasarcoMandate' | translate }}</span>
                <nz-select
                  nzId="wr-sim-mandate"
                  nzAllowClear
                  [ngModel]="store.form().enasarco_mandate"
                  (ngModelChange)="store.patch({ enasarco_mandate: $event ?? null })"
                >
                  @for (mandate of mandates; track mandate) {
                    <nz-option
                      [nzValue]="mandate"
                      [nzLabel]="'withholdingRecipients.enasarcoMandate.' + mandate | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <div class="checks wide">
                <label
                  for="wr-sim-firr"
                  nzId="wr-sim-firr"
                  nz-checkbox
                  [ngModel]="store.form().firr_enabled"
                  (ngModelChange)="store.patch({ firr_enabled: $event })"
                  >{{ 'withholdingRecipients.field.firrEnabled' | translate }}</label
                >
                <label
                  for="wr-sim-certificate"
                  nzId="wr-sim-certificate"
                  nz-checkbox
                  [ngModel]="store.form().has_reduced_certificate"
                  (ngModelChange)="store.patch({ has_reduced_certificate: $event })"
                  >{{ 'withholdingRecipients.field.reducedCertificate' | translate }}</label
                >
              </div>
            }

            @if (declaresIncome()) {
              <label class="field" for="wr-sim-prior-company">
                <span>{{ 'withholdingRecipients.field.priorCompanyIncome' | translate }}</span>
                <nz-input-number
                  nzId="wr-sim-prior-company"
                  [nzMin]="0"
                  [ngModel]="store.form().prior_company_income"
                  (ngModelChange)="store.patch({ prior_company_income: $event })"
                ></nz-input-number>
              </label>
              <label class="field" for="wr-sim-third">
                <span>{{ 'withholdingRecipients.field.thirdPartyIncome' | translate }}</span>
                <nz-input-number
                  nzId="wr-sim-third"
                  [nzMin]="0"
                  [ngModel]="store.form().third_party_income"
                  (ngModelChange)="store.patch({ third_party_income: $event })"
                ></nz-input-number>
              </label>
            }

            @if (store.regime() === 'swiss_foreign_artist') {
              <label class="field" for="wr-sim-activity">
                <span>{{ 'withholdingRecipients.field.activityType' | translate }}</span>
                <nz-select
                  nzId="wr-sim-activity"
                  nzAllowClear
                  [ngModel]="store.form().activity_type"
                  (ngModelChange)="store.patch({ activity_type: $event ?? null })"
                >
                  @for (type of activityTypes; track type) {
                    <nz-option
                      [nzValue]="type"
                      [nzLabel]="'withholdingRecipients.activityType.' + type | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
            }

            @if (store.regime() === 'swiss_de_minimis') {
              <label class="field" for="wr-sim-prior-avs">
                <span>{{ 'withholdingRecipients.field.priorAvsBase' | translate }}</span>
                <nz-input-number
                  nzId="wr-sim-prior-avs"
                  [nzMin]="0"
                  [ngModel]="store.form().prior_avs_base"
                  (ngModelChange)="store.patch({ prior_avs_base: $event })"
                ></nz-input-number>
              </label>
              <div class="checks wide">
                <label
                  for="wr-sim-cultural"
                  nzId="wr-sim-cultural"
                  nz-checkbox
                  [ngModel]="store.form().is_cultural_sector"
                  (ngModelChange)="store.patch({ is_cultural_sector: $event })"
                  >{{ 'withholdingRecipients.field.culturalSector' | translate }}</label
                >
              </div>
            }
          </div>
        }

        <div class="footer">
          <button nz-button type="button" (click)="store.reset()">
            {{ 'withholdingRecipients.action.reset' | translate }}
          </button>
        </div>
      </nz-card>

      <nz-card [nzTitle]="'withholdingRecipients.simulator.result' | translate">
        <nz-spin [nzSpinning]="store.loading()">
          @if (store.error(); as error) {
            <nz-alert
              class="feedback"
              nzType="error"
              nzShowIcon
              [nzMessage]="error | translate"
              [nzDescription]="store.detail() ?? ''"
            ></nz-alert>
          }
          @if (store.result(); as result) {
            <app-wr-simulation-result [result]="result"></app-wr-simulation-result>
          } @else if (!store.error()) {
            <nz-empty
              [nzNotFoundContent]="'withholdingRecipients.simulator.empty' | translate"
            ></nz-empty>
          }
        </nz-spin>
      </nz-card>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
      align-items: start;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .hint {
      margin: 0;
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .title {
      margin: 20px 0 12px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class SimulatorComponent implements OnInit, OnDestroy {
  readonly store = inject(SimulatorStore);

  readonly regimes = WR_REGIMES;
  readonly mandates = WR_ENASARCO_MANDATES;
  readonly activityTypes = WR_ACTIVITY_TYPES;

  swiss(): boolean {
    return isSwissRegime(this.store.regime());
  }

  agent(): boolean {
    return isAgentRegime(this.store.regime());
  }

  declaresIncome(): boolean {
    return declaresThirdPartyIncome(this.store.regime());
  }

  ngOnInit(): void {
    void this.store.init();
  }

  ngOnDestroy(): void {
    this.store.dispose();
  }
}
