import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GdtContractPayload,
  GdtPromotion,
  GdtPromotionPayload,
  GdtScale,
  GdtScalePayload,
  GdtScaleProgress,
  GdtTransition,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ContractDetailStore } from './contract-detail.store';
import { ContractFormComponent } from './contract-form.component';
import {
  contractActions,
  contractStatusColor,
  GdtOutcome,
  percentText,
  promotionActions,
  promotionStatusColor,
} from './gdo-trade-terms.util';
import { ProgressPanelComponent } from './progress-panel.component';
import { PromotionDrawerComponent } from './promotion-drawer.component';
import { ScaleDrawerComponent } from './scale-drawer.component';
import { SimulatorPanelComponent } from './simulator-panel.component';

/**
 * A framework contract: the terms (on-invoice cascade, settlement rules and accounts), the tiered rebate scales, the trade
 * promotions, and the attainment with the year-end projection and the bracket simulator.
 */
@Component({
  selector: 'app-gdt-contract-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContractFormComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    ProgressPanelComponent,
    PromotionDrawerComponent,
    RouterLink,
    ScaleDrawerComponent,
    SimulatorPanelComponent,
    TranslatePipe,
  ],
  providers: [ContractDetailStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_CONTRACT' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.contract(); as contract) {
        <nz-card class="main-card">
          <div class="toolbar">
            <div>
              <strong>{{ contract.code }}</strong> · {{ contract.name }}
              <small class="muted">
                {{ contract.contact?.name }} · {{ contract.starts_on }} – {{ contract.ends_on }} ·
                {{ 'gdoTradeTerms.jurisdiction.' + contract.jurisdiction | translate }} · {{ contract.currency }}
              </small>
            </div>
            <nz-tag [nzColor]="color(contract.status)">{{ 'gdoTradeTerms.contractStatus.' + contract.status | translate }}</nz-tag>
            <span class="spacer"></span>
            <a nz-button [routerLink]="['/gdo-trade-terms/contracts']">{{ 'gdoTradeTerms.action.back' | translate }}</a>
            @for (action of actions(); track action) {
              <button
                nz-button
                type="button"
                nz-popconfirm
                [nzType]="action === 'activate' || action === 'resume' ? 'primary' : 'default'"
                [nzDanger]="action === 'cancel'"
                [nzPopconfirmTitle]="'gdoTradeTerms.confirm.contract.' + action | translate"
                [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
                [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                (nzOnConfirm)="transition(action)"
              >
                {{ 'gdoTradeTerms.action.contract.' + action | translate }}
              </button>
            }
          </div>
        </nz-card>

        <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="tab.set($event)">
          <nz-tab [nzTitle]="'gdoTradeTerms.tab.terms' | translate">
            <nz-card class="main-card">
              <app-gdt-contract-form
                [contract]="contract"
                [customers]="store.customers()"
                [accounts]="store.accounts()"
                [saving]="store.saving()"
                [readOnly]="!store.editable()"
                [error]="formError()"
                (submitted)="saveContract($event)"
              ></app-gdt-contract-form>
            </nz-card>
          </nz-tab>

          <nz-tab [nzTitle]="'gdoTradeTerms.tab.scales' | translate">
            <div class="toolbar">
              <span class="spacer"></span>
              <button nz-button nzType="primary" type="button" [disabled]="!store.editable()" (click)="openScale(null)">
                {{ 'gdoTradeTerms.action.newScale' | translate }}
              </button>
            </div>
            <nz-table #scales nzSize="small" [nzData]="store.scales()" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'gdoTradeTerms.field.scale' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.tierMode' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.basis' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.volumeMode' | translate }}</th>
                  <th scope="col" class="num">{{ 'gdoTradeTerms.field.tiers' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.active' | translate }}</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                @for (scale of scales.data; track scale.id) {
                  <tr>
                    <th scope="row">
                      {{ scale.code }}
                      <small class="muted">{{ scale.name }}</small>
                    </th>
                    <td>{{ 'gdoTradeTerms.tierMode.' + scale.tier_mode | translate }}</td>
                    <td>{{ 'gdoTradeTerms.basis.' + scale.basis | translate }}</td>
                    <td>{{ 'gdoTradeTerms.volumeMode.' + scale.volume_mode | translate }}</td>
                    <td class="num">{{ scale.tiers.length }}</td>
                    <td>
                      <nz-tag [nzColor]="scale.is_active ? 'green' : 'default'">
                        {{ (scale.is_active ? 'gdoTradeTerms.field.active' : 'gdoTradeTerms.field.inactive') | translate }}
                      </nz-tag>
                    </td>
                    <td>
                      <button nz-button nzSize="small" type="button" [disabled]="!store.editable()" (click)="openScale(scale)">
                        {{ 'gdoTradeTerms.action.edit' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        nz-popconfirm
                        [disabled]="!store.editable()"
                        [nzPopconfirmTitle]="'gdoTradeTerms.confirm.deleteScale' | translate"
                        [nzOkText]="'gdoTradeTerms.action.delete' | translate"
                        [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                        (nzOnConfirm)="removeScale(scale)"
                      >
                        {{ 'gdoTradeTerms.action.delete' | translate }}
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.scales' | translate"></nz-empty></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab [nzTitle]="'gdoTradeTerms.tab.promotions' | translate">
            <div class="toolbar">
              <span class="spacer"></span>
              <button nz-button nzType="primary" type="button" [disabled]="!store.editable()" (click)="openPromotion(null)">
                {{ 'gdoTradeTerms.action.newPromotion' | translate }}
              </button>
            </div>
            <nz-table #promotions nzSize="small" [nzData]="store.promotions()" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'gdoTradeTerms.field.promotion' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.promotionType' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.period' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.contributionMode' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.treatment' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                @for (promotion of promotions.data; track promotion.id) {
                  <tr>
                    <th scope="row">
                      {{ promotion.code }}
                      <small class="muted">{{ promotion.name }}</small>
                    </th>
                    <td>{{ 'gdoTradeTerms.promotionType.' + promotion.promotion_type | translate }}</td>
                    <td>{{ promotion.starts_on }} – {{ promotion.ends_on }}</td>
                    <td>{{ 'gdoTradeTerms.contributionMode.' + promotion.contribution_mode | translate }}</td>
                    <td>{{ 'gdoTradeTerms.treatment.' + promotion.treatment | translate }}</td>
                    <td>
                      <nz-tag [nzColor]="promotionColor(promotion.status)">{{ 'gdoTradeTerms.promotionStatus.' + promotion.status | translate }}</nz-tag>
                    </td>
                    <td>
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        [disabled]="!store.editable() || promotion.status === 'cancelled' || promotion.status === 'ended'"
                        (click)="openPromotion(promotion)"
                      >
                        {{ 'gdoTradeTerms.action.edit' | translate }}
                      </button>
                      @for (action of promotionActions(promotion); track action) {
                        <button
                          nz-button
                          nzSize="small"
                          type="button"
                          nz-popconfirm
                          [nzDanger]="action === 'cancel'"
                          [disabled]="!store.editable()"
                          [nzPopconfirmTitle]="'gdoTradeTerms.confirm.promotion.' + action | translate"
                          [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
                          [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                          (nzOnConfirm)="transitionPromotion(promotion, action)"
                        >
                          {{ 'gdoTradeTerms.action.promotion.' + action | translate }}
                        </button>
                      }
                      @if (promotion.status === 'draft') {
                        <button
                          nz-button
                          nzSize="small"
                          nzDanger
                          type="button"
                          nz-popconfirm
                          [disabled]="!store.editable()"
                          [nzPopconfirmTitle]="'gdoTradeTerms.confirm.deletePromotion' | translate"
                          [nzOkText]="'gdoTradeTerms.action.delete' | translate"
                          [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                          (nzOnConfirm)="removePromotion(promotion)"
                        >
                          {{ 'gdoTradeTerms.action.delete' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.promotions' | translate"></nz-empty></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab [nzTitle]="'gdoTradeTerms.tab.attainment' | translate">
            <app-gdt-progress-panel
              [progress]="store.progress()"
              [loading]="store.progressLoading()"
              (simulate)="simulate($event)"
            ></app-gdt-progress-panel>
          </nz-tab>

          <nz-tab [nzTitle]="'gdoTradeTerms.tab.simulator' | translate">
            <nz-card class="main-card">
              <app-gdt-simulator-panel [scale]="simulated()" [currency]="contract.currency"></app-gdt-simulator-panel>
            </nz-card>
          </nz-tab>
        </nz-tabs>

        <app-gdt-scale-drawer
          [visible]="scaleOpen()"
          [scale]="editingScale()"
          [categories]="store.categories()"
          [brands]="store.brands()"
          [points]="store.points()"
          [saving]="store.saving()"
          [error]="drawerError()"
          (saved)="saveScale($event)"
          (closed)="scaleOpen.set(false)"
        ></app-gdt-scale-drawer>

        <app-gdt-promotion-drawer
          [visible]="promotionOpen()"
          [promotion]="editingPromotion()"
          [categories]="store.categories()"
          [brands]="store.brands()"
          [points]="store.points()"
          [saving]="store.saving()"
          [error]="drawerError()"
          (saved)="savePromotion($event)"
          (closed)="promotionOpen.set(false)"
        ></app-gdt-promotion-drawer>
      }
    </nz-spin>
  `,
})
export class ContractDetailComponent implements OnInit {
  protected readonly store = inject(ContractDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly feedback = signal<GdtOutcome | null>(null);
  protected readonly formError = signal<GdtOutcome | null>(null);
  protected readonly drawerError = signal<GdtOutcome | null>(null);
  protected readonly scaleOpen = signal(false);
  protected readonly promotionOpen = signal(false);
  protected readonly editingScale = signal<GdtScale | null>(null);
  protected readonly editingPromotion = signal<GdtPromotion | null>(null);
  protected readonly simulated = signal<GdtScaleProgress | null>(null);
  protected readonly tab = signal(0);

  protected readonly actions = computed(() => {
    const status = this.store.contract()?.status;
    return status === undefined ? [] : contractActions(status);
  });

  protected color = contractStatusColor;
  protected promotionColor = promotionStatusColor;
  protected pct = percentText;

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    void this.store.load(this.id);
  }

  protected promotionActions(promotion: GdtPromotion): readonly ('activate' | 'end' | 'cancel')[] {
    return promotionActions(promotion.status);
  }

  protected async saveContract(payload: GdtContractPayload): Promise<void> {
    this.formError.set(null);
    const outcome = await this.store.saveContract(this.id, payload);
    this.formError.set(outcome.ok ? null : outcome);
    this.done(outcome, 'saved');
  }

  protected async transition(action: GdtTransition): Promise<void> {
    this.done(await this.store.transition(this.id, action), 'transitioned');
  }

  protected openScale(scale: GdtScale | null): void {
    this.drawerError.set(null);
    this.editingScale.set(scale);
    this.scaleOpen.set(true);
  }

  protected async saveScale(payload: GdtScalePayload): Promise<void> {
    const outcome = await this.store.saveScale(this.id, this.editingScale()?.id ?? null, payload);
    this.drawerError.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.scaleOpen.set(false);
    }
    this.done(outcome, 'saved', false);
  }

  protected async removeScale(scale: GdtScale): Promise<void> {
    this.done(await this.store.removeScale(this.id, scale.id), 'deleted');
  }

  protected openPromotion(promotion: GdtPromotion | null): void {
    this.drawerError.set(null);
    this.editingPromotion.set(promotion);
    this.promotionOpen.set(true);
  }

  protected async savePromotion(payload: GdtPromotionPayload): Promise<void> {
    const outcome = await this.store.savePromotion(this.id, this.editingPromotion()?.id ?? null, payload);
    this.drawerError.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.promotionOpen.set(false);
    }
    this.done(outcome, 'saved', false);
  }

  protected async transitionPromotion(promotion: GdtPromotion, action: GdtTransition): Promise<void> {
    this.done(await this.store.transitionPromotion(this.id, promotion.id, action), 'transitioned');
  }

  protected async removePromotion(promotion: GdtPromotion): Promise<void> {
    this.done(await this.store.removePromotion(this.id, promotion.id), 'deleted');
  }

  protected simulate(scale: GdtScaleProgress): void {
    this.simulated.set(scale);
    this.tab.set(4);
  }

  private done(outcome: GdtOutcome, done: string, showFailure = true): void {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant(`gdoTradeTerms.message.${done}`));
    } else if (showFailure) {
      this.feedback.set(outcome);
    }
  }
}
