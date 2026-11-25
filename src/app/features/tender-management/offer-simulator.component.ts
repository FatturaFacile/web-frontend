import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TndOfferPayload, TndOfferResult, TndParticipationDetail } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { calculateOffer, OfferInput, parseDecimal, roundHalfUp } from './tender-offer-calculator';
import { issueKey } from './tender-management.util';

/**
 * Economic offer and OEPV score simulator (Mod 169): the discount (or unit-price result) against the margin, the mandatory
 * Art. 108 co. 9 labor and company safety costs, the technical + economic score by Linear / Bilinear / Interpolation formula,
 * the anomaly threshold and the provisional bid bond with its cumulative Art. 106 reductions. The figures answer while the user
 * types; the server calculation is authoritative and can be saved on the dossier.
 */
@Component({
  selector: 'app-tnd-offer-simulator',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSliderModule,
    NzStatisticModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (detail(); as dossier) {
      <div class="layout">
        <form class="inputs" (submit)="$event.preventDefault()">
          <label class="field" for="tnd-offer-discount">
            <span>{{ 'tenderManagement.offer.discount' | translate }}</span>
            <nz-slider [nzMin]="0" [nzMax]="60" [nzStep]="0.01" [ngModel]="discount()" (ngModelChange)="discount.set($event)" name="discountSlider"></nz-slider>
            <input nz-input id="tnd-offer-discount" type="number" min="0" max="100" step="0.01" [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)" name="discount" />
          </label>
          <label class="field" for="tnd-offer-cost">
            <span>{{ 'tenderManagement.offer.estimatedCost' | translate }}</span>
            <input nz-input id="tnd-offer-cost" type="number" min="0" step="0.01" [ngModel]="estimatedCost()" (ngModelChange)="estimatedCost.set($event === '' ? null : +$event)" name="cost" />
          </label>
          <label class="field" for="tnd-offer-other">
            <span>{{ 'tenderManagement.offer.otherDirectCosts' | translate }}</span>
            <input nz-input id="tnd-offer-other" type="number" min="0" step="0.01" [ngModel]="otherCosts()" (ngModelChange)="otherCosts.set(+$event || 0)" name="other" />
          </label>
          <label class="field" for="tnd-offer-safety">
            <span>{{ 'tenderManagement.offer.companySafetyCosts' | translate }}</span>
            <input nz-input id="tnd-offer-safety" type="number" min="0" step="0.01" [ngModel]="safety()" (ngModelChange)="safety.set(+$event || 0)" name="safety" />
          </label>
          <label class="field" for="tnd-offer-labor">
            <span>{{ 'tenderManagement.offer.laborCosts' | translate }}</span>
            <input nz-input id="tnd-offer-labor" type="number" min="0" step="0.01" [ngModel]="labor()" (ngModelChange)="labor.set(+$event || 0)" name="labor" />
          </label>
          <label class="field" for="tnd-offer-bond">
            <span>{{ 'tenderManagement.offer.bidBasePercentage' | translate }}</span>
            <nz-select nzId="tnd-offer-bond" [ngModel]="bondBase()" (ngModelChange)="bondBase.set($event)" name="bond">
              @for (value of bondOptions(); track value) {
                <nz-option [nzValue]="value" [nzLabel]="value + ' %'"></nz-option>
              }
            </nz-select>
          </label>
          @if (oepv()) {
            <label class="field" for="tnd-offer-tech">
              <span>{{ 'tenderManagement.offer.technicalEstimate' | translate: { max: technicalMax() } }}</span>
              <input nz-input id="tnd-offer-tech" type="number" min="0" [attr.max]="technicalMax()" step="0.01" [ngModel]="technical()" (ngModelChange)="technical.set(+$event || 0)" name="tech" />
            </label>
          }
          <label class="field" for="tnd-offer-best">
            <span>{{ 'tenderManagement.offer.bestCompetitor' | translate }}</span>
            <input nz-input id="tnd-offer-best" type="number" min="0" max="100" step="0.01" [ngModel]="bestCompetitor()" (ngModelChange)="bestCompetitor.set($event === '' ? null : +$event)" name="best" />
          </label>
          <label class="field" for="tnd-offer-competitors">
            <span>{{ 'tenderManagement.offer.competitorDiscounts' | translate }}</span>
            <nz-select nzId="tnd-offer-competitors" nzMode="tags" [ngModel]="competitorTags()" (ngModelChange)="setCompetitors($event)" name="competitors"></nz-select>
          </label>
          @if (history().length > 0) {
            <button nz-button type="button" (click)="useHistory()">
              {{ 'tenderManagement.offer.useHistory' | translate: { count: history().length } }}
            </button>
          }
        </form>

        <div class="results" aria-live="polite">
          <div class="kpis">
            <nz-statistic [nzTitle]="'tenderManagement.offer.offeredAmount' | translate" [nzValue]="calc().offeredAmount | money: dossier.notice.currency"></nz-statistic>
            <nz-statistic [nzTitle]="'tenderManagement.offer.netMargin' | translate" [nzValue]="calc().netMargin | money: dossier.notice.currency" [nzValueStyle]="{ color: calc().netMargin < 0 ? '#cf1322' : '#3f8600' }"></nz-statistic>
            <nz-statistic [nzTitle]="'tenderManagement.offer.netMarginPercentage' | translate" [nzValue]="calc().netMarginPercentage + ' %'"></nz-statistic>
          </div>

          @if (oepv()) {
            <div class="kpis">
              <nz-statistic [nzTitle]="'tenderManagement.offer.technicalScore' | translate" [nzValue]="calc().technicalScore + ' / ' + technicalMax()"></nz-statistic>
              <nz-statistic [nzTitle]="'tenderManagement.offer.economicScore' | translate" [nzValue]="calc().economicScore + ' / ' + economicMax()"></nz-statistic>
              <nz-statistic [nzTitle]="'tenderManagement.offer.totalScore' | translate" [nzValue]="calc().totalScore"></nz-statistic>
            </div>
            <p>
              {{ 'tenderManagement.offer.formulaUsed' | translate }}:
              <nz-tag>{{ 'tenderManagement.enum.formulaType.' + (dossier.notice.formula_type ?? 'Linear') | translate }}</nz-tag>
            </p>
          }

          @if (calc().anomaly.isAnomalous) {
            <nz-alert nzType="warning" nzShowIcon [nzMessage]="'tenderManagement.compliance.anomaly_threshold_exceeded' | translate"></nz-alert>
          }

          @for (issue of blockingAndWarnings(); track issue.code) {
            <nz-alert class="issue" nzShowIcon [nzType]="issue.severity === 'blocking' ? 'error' : 'warning'" [nzMessage]="issueText(issue) | translate: issue.params ?? {}"></nz-alert>
          }

          <section class="bond">
            <h3>{{ 'tenderManagement.offer.bondTitle' | translate }}</h3>
            <p>
              {{ 'tenderManagement.offer.bondBase' | translate: { percentage: bondBase() } }}:
              <strong>{{ calc().bond.baseAmount | money: dossier.notice.currency }}</strong>
            </p>
            <ul>
              @for (reduction of calc().bond.reductions; track reduction.key) {
                <li>
                  {{ 'tenderManagement.offer.reduction.' + reduction.key | translate }}:
                  −{{ percent(reduction.percentage) }} %
                </li>
              } @empty {
                <li>{{ 'tenderManagement.offer.noReductions' | translate }}</li>
              }
            </ul>
            <p>
              {{ 'tenderManagement.offer.bondFinal' | translate }}:
              <strong>{{ calc().bond.finalAmount | money: dossier.notice.currency }}</strong>
              <nz-tag>−{{ calc().bond.totalReductionPercentage }} %</nz-tag>
            </p>
            @if (dossier.provisional_bid_bond_id) {
              <nz-tag nzColor="blue">{{ 'tenderManagement.offer.linkedBond' | translate }}</nz-tag>
            }
          </section>

          @if (server(); as result) {
            <section class="server">
              <h3>{{ 'tenderManagement.offer.serverResult' | translate }}</h3>
              <p>
                {{ 'tenderManagement.offer.offeredAmount' | translate }}: <strong>{{ result.offered_amount | money: dossier.notice.currency }}</strong>
                · {{ 'tenderManagement.offer.netMargin' | translate }}: <strong>{{ result.net_margin_amount | money: dossier.notice.currency }}</strong>
                @if (result.anac_contribution_amount) {
                  · {{ 'tenderManagement.offer.anacContribution' | translate }}:
                  <strong>{{ result.anac_contribution_amount | money: dossier.notice.currency }}</strong>
                }
              </p>
              @if (result.submission_blocked) {
                <nz-tag nzColor="red">{{ 'tenderManagement.offer.submissionBlocked' | translate }}</nz-tag>
              }
            </section>
          }

          <div class="buttons">
            <button nz-button type="button" [disabled]="busy()" (click)="send(false)">
              {{ 'tenderManagement.action.calculateServer' | translate }}
            </button>
            <button nz-button nzType="primary" type="button" [disabled]="busy() || calc().submissionBlocked" (click)="send(true)">
              {{ 'tenderManagement.action.saveOffer' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.4fr);
      gap: 24px;
    }
    .inputs {
      display: grid;
      gap: 12px;
      align-content: start;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 12px;
    }
    .issue {
      margin-bottom: 6px;
    }
    .bond,
    .server {
      margin-top: 16px;
    }
    .buttons {
      margin-top: 16px;
      display: flex;
      gap: 8px;
    }
  `,
})
export class OfferSimulatorComponent {
  readonly detail = input<TndParticipationDetail | null>(null);
  /** Rates of the Art. 106 reductions by key (fractions). */
  readonly bondRates = input<Record<string, number>>({});
  readonly heldKeys = input<string[]>([]);
  readonly allowedBasePercentages = input<string[]>(['1.00', '2.00']);
  /** Offered discounts of the competitors in the history of the contracting authority. */
  readonly history = input<number[]>([]);
  readonly server = input<TndOfferResult | null>(null);
  readonly defaults = input<{ technical: string; economic: string }>({ technical: '70', economic: '30' });
  readonly busy = input(false);

  readonly calculate = output<TndOfferPayload>();

  protected readonly discount = signal(0);
  protected readonly estimatedCost = signal<number | null>(null);
  protected readonly otherCosts = signal(0);
  protected readonly safety = signal(0);
  protected readonly labor = signal(0);
  protected readonly bondBase = signal('2.00');
  protected readonly technical = signal(0);
  protected readonly bestCompetitor = signal<number | null>(null);
  protected readonly competitors = signal<number[]>([]);

  protected readonly oepv = computed(
    () => this.detail()?.notice.award_criterion === 'OEPV_MostEconomicallyAdvantageous',
  );
  protected readonly technicalMax = computed(() =>
    parseDecimal(this.detail()?.notice.technical_max_score ?? this.defaults().technical),
  );
  protected readonly economicMax = computed(() =>
    parseDecimal(this.detail()?.notice.economic_max_score ?? this.defaults().economic),
  );
  protected readonly bondOptions = computed(() => this.allowedBasePercentages());
  protected readonly competitorTags = computed(() => this.competitors().map(String));

  protected readonly calc = computed(() => {
    const notice = this.detail()?.notice;
    if (!notice) {
      return calculateOffer(EMPTY_INPUT);
    }
    const input: OfferInput = {
      jurisdiction: notice.jurisdiction,
      awardCriterion: notice.award_criterion,
      formula: notice.formula_type,
      baseAuctionAmount: parseDecimal(notice.base_auction_amount),
      nonSubjectSafetyCosts: parseDecimal(notice.non_subject_safety_costs_amount),
      estimatedLaborCostAmount: parseDecimal(notice.estimated_labor_cost_amount),
      discountPercentage: this.discount(),
      estimatedTotalCost: this.estimatedCost(),
      otherDirectCosts: this.otherCosts(),
      companySafetyCostsDeclared: this.safety(),
      companyLaborCostsDeclared: this.labor(),
      technicalMax: this.technicalMax(),
      economicMax: this.economicMax(),
      technicalScoreEstimate: this.technical(),
      bestCompetitorDiscount: this.bestCompetitor(),
      competitorDiscounts: this.competitors(),
      bidBasePercentage: parseDecimal(this.bondBase()),
      bondReductionRates: this.bondRates(),
      heldReductionKeys: this.heldKeys(),
    };
    return calculateOffer(input);
  });

  protected readonly blockingAndWarnings = computed(() =>
    this.calc().issues.filter((issue) => issue.code !== 'anomaly_threshold_exceeded'),
  );

  constructor() {
    effect(() => {
      const dossier = this.detail();
      if (!dossier) {
        return;
      }
      this.discount.set(parseDecimal(dossier.economic_discount_percentage_offered));
      this.estimatedCost.set(dossier.estimated_total_cost === null ? null : parseDecimal(dossier.estimated_total_cost));
      this.safety.set(parseDecimal(dossier.company_safety_costs_declared));
      this.labor.set(parseDecimal(dossier.company_labor_costs_declared));
      this.technical.set(parseDecimal(dossier.technical_envelope_score_target));
      if (dossier.bid_bond_base_percentage) {
        this.bondBase.set(Number(dossier.bid_bond_base_percentage).toFixed(2));
      }
    });
  }

  protected issueText(issue: { code: string }): string {
    return issueKey(issue);
  }

  protected percent(fraction: number): number {
    return roundHalfUp(fraction * 100, 2);
  }

  protected setCompetitors(tags: string[]): void {
    this.competitors.set(
      tags.map((tag) => Number(tag)).filter((value) => Number.isFinite(value) && value >= 0 && value <= 100),
    );
  }

  protected useHistory(): void {
    this.competitors.set([...this.history()]);
  }

  protected send(persist: boolean): void {
    this.calculate.emit({
      discount_percentage: this.discount(),
      estimated_total_cost: this.estimatedCost(),
      other_direct_costs: this.otherCosts(),
      company_safety_costs_declared: this.safety(),
      company_labor_costs_declared: this.labor(),
      bid_base_percentage: this.bondBase(),
      technical_score_estimate: this.oepv() ? this.technical() : null,
      best_competitor_discount: this.bestCompetitor(),
      competitor_discounts: this.competitors(),
      persist,
    });
  }
}

const EMPTY_INPUT: OfferInput = {
  jurisdiction: 'PrivateRfp',
  awardCriterion: 'LowestPrice',
  formula: null,
  baseAuctionAmount: 0,
  nonSubjectSafetyCosts: 0,
  estimatedLaborCostAmount: 0,
  discountPercentage: 0,
  estimatedTotalCost: null,
  otherDirectCosts: 0,
  companySafetyCostsDeclared: 0,
  companyLaborCostsDeclared: 0,
  technicalMax: 0,
  economicMax: 0,
  technicalScoreEstimate: 0,
  bestCompetitorDiscount: null,
  competitorDiscounts: [],
  bidBasePercentage: 2,
  bondReductionRates: {},
  heldReductionKeys: [],
};
