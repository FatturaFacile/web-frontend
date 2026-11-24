import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AttributionModel,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_TRIGGERS,
  CampaignChannel,
  CampaignTrigger,
  I18nService,
  MAIL_PROVIDERS,
  MailProviderCode,
  MarketingCampaign,
  SaveCampaignPayload,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MarketingNavComponent } from './marketing-nav.component';
import { MarketingAutomationStore } from './marketing-automation.store';
import { allowedActions, auditReasonKey } from './marketing-automation.util';

interface CampaignForm {
  name: string;
  channel: CampaignChannel;
  trigger: CampaignTrigger;
  segmentId: string | null;
  senderName: string;
  senderEmail: string;
  senderAddress: string;
  provider: MailProviderCode;
  attributionModel: AttributionModel;
  windowDays: number;
  utm: string;
  currency: string;
  cost: number;
  coupon: string;
}

const emptyForm = (): CampaignForm => ({
  name: '',
  channel: 'email_dem',
  trigger: 'scheduled_broadcast',
  segmentId: null,
  senderName: '',
  senderEmail: '',
  senderAddress: '',
  provider: 'smtp',
  attributionModel: 'last_touch',
  windowDays: 30,
  utm: '',
  currency: 'CHF',
  cost: 0,
  coupon: '',
});

/** Campaigns and journeys: list, lifecycle, sender identity, attribution settings, step logs and A/B test results. */
@Component({
  selector: 'app-marketing-campaigns',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MarketingNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'marketing.campaigns.title' | translate"
      [subtitle]="'marketing.campaigns.subtitle' | translate"
    >
      <button nz-button nzType="primary" (click)="startNew()">{{ 'marketing.campaigns.new' | translate }}</button>
    </app-page-header>
    <app-marketing-nav activeTab="campaigns" />

    @if (store.errorCode(); as code) {
      <p class="mb-4 text-red-600" role="alert">
        {{ code | translate }}
        @for (detail of store.errorDetails(); track detail) {
          <span class="block text-sm">{{ detail }}</span>
        }
      </p>
    }

    @if (editing()) {
      <nz-card class="mb-4" [nzTitle]="(editingId() ? 'marketing.campaigns.edit' : 'marketing.campaigns.new') | translate">
        <div class="grid gap-3 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-name">{{ 'marketing.field.name' | translate }}</label>
            <input nz-input id="cmp-name" [ngModel]="form().name" (ngModelChange)="set('name', $event)" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-channel">{{ 'marketing.field.channel' | translate }}</label>
            <nz-select nzId="cmp-channel" class="w-full" [ngModel]="form().channel" (ngModelChange)="set('channel', $event)">
              @for (channel of channels; track channel) {
                <nz-option [nzValue]="channel" [nzLabel]="'marketing.channel.' + channel | translate" />
              }
            </nz-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-trigger">{{ 'marketing.field.trigger' | translate }}</label>
            <nz-select nzId="cmp-trigger" class="w-full" [ngModel]="form().trigger" (ngModelChange)="set('trigger', $event)">
              @for (trigger of triggers; track trigger) {
                <nz-option [nzValue]="trigger" [nzLabel]="'marketing.trigger.' + trigger | translate" />
              }
            </nz-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-segment">{{ 'marketing.field.segment' | translate }}</label>
            <nz-select nzId="cmp-segment" class="w-full" nzAllowClear [ngModel]="form().segmentId" (ngModelChange)="set('segmentId', $event ?? null)">
              @for (segment of store.segments(); track segment.id) {
                <nz-option [nzValue]="segment.id" [nzLabel]="segment.name + ' (' + segment.eligible_contacts_count + ')'" />
              }
            </nz-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-provider">{{ 'marketing.field.provider' | translate }}</label>
            <nz-select nzId="cmp-provider" class="w-full" [ngModel]="form().provider" (ngModelChange)="set('provider', $event)">
              @for (provider of providers; track provider) {
                <nz-option [nzValue]="provider" [nzLabel]="'marketing.provider.' + provider | translate" />
              }
            </nz-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-utm">{{ 'marketing.field.utm' | translate }}</label>
            <input nz-input id="cmp-utm" [ngModel]="form().utm" (ngModelChange)="set('utm', $event)" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-sender-name">{{ 'marketing.field.sender_name' | translate }}</label>
            <input nz-input id="cmp-sender-name" [ngModel]="form().senderName" (ngModelChange)="set('senderName', $event)" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-sender-email">{{ 'marketing.field.sender_email' | translate }}</label>
            <input nz-input id="cmp-sender-email" type="email" [ngModel]="form().senderEmail" (ngModelChange)="set('senderEmail', $event)" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-sender-address">{{ 'marketing.field.sender_address' | translate }}</label>
            <input nz-input id="cmp-sender-address" [ngModel]="form().senderAddress" (ngModelChange)="set('senderAddress', $event)" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-attribution">{{ 'marketing.field.attribution_model' | translate }}</label>
            <nz-select nzId="cmp-attribution" class="w-full" [ngModel]="form().attributionModel" (ngModelChange)="set('attributionModel', $event)">
              <nz-option nzValue="first_touch" [nzLabel]="'marketing.attribution.first_touch' | translate" />
              <nz-option nzValue="last_touch" [nzLabel]="'marketing.attribution.last_touch' | translate" />
            </nz-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-window">{{ 'marketing.field.attribution_window' | translate }}</label>
            <nz-input-number nzId="cmp-window" [ngModel]="form().windowDays" (ngModelChange)="set('windowDays', $event ?? 30)" [nzMin]="1" [nzMax]="365" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="cmp-coupon">{{ 'marketing.field.coupon' | translate }}</label>
            <input nz-input id="cmp-coupon" [ngModel]="form().coupon" (ngModelChange)="set('coupon', $event)" />
          </div>
          <div class="flex gap-2">
            <div>
              <label class="mb-1 block text-xs font-medium" for="cmp-currency">{{ 'marketing.field.currency' | translate }}</label>
              <nz-select nzId="cmp-currency" [ngModel]="form().currency" (ngModelChange)="set('currency', $event)">
                <nz-option nzValue="CHF" nzLabel="CHF" />
                <nz-option nzValue="EUR" nzLabel="EUR" />
              </nz-select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium" for="cmp-cost">{{ 'marketing.field.cost' | translate }}</label>
              <nz-input-number nzId="cmp-cost" [ngModel]="form().cost" (ngModelChange)="set('cost', $event ?? 0)" [nzMin]="0" />
            </div>
          </div>
        </div>
        <div class="mt-4 flex gap-2">
          <button nz-button nzType="primary" (click)="save()" [disabled]="!form().name.trim() || store.saving()">{{ 'marketing.action.save' | translate }}</button>
          <button nz-button (click)="editing.set(false)">{{ 'marketing.action.cancel' | translate }}</button>
        </div>
      </nz-card>
    }

    <nz-card>
      <nz-table #table [nzData]="store.campaigns()" [nzLoading]="store.loading()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'marketing.field.name' | translate }}</th>
            <th>{{ 'marketing.field.status' | translate }}</th>
            <th>{{ 'marketing.field.channel' | translate }}</th>
            <th>{{ 'marketing.field.trigger' | translate }}</th>
            <th>{{ 'marketing.kpi.roi' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (campaign of table.data; track campaign.id) {
            <tr [class.font-semibold]="campaign.id === selectedId()">
              <td>{{ campaign.name }}</td>
              <td><nz-tag>{{ 'marketing.status.' + campaign.status | translate }}</nz-tag></td>
              <td>{{ 'marketing.channel.' + campaign.channel | translate }}</td>
              <td>{{ 'marketing.trigger.' + campaign.trigger_type | translate }}</td>
              <td>
                @if (campaign.metric?.calculated_roi_percentage === null || campaign.metric?.calculated_roi_percentage === undefined) {
                  <span class="text-gray-500">{{ 'marketing.roi.no_cost' | translate }}</span>
                } @else {
                  {{ campaign.metric?.calculated_roi_percentage | number: '1.0-1' }} %
                }
              </td>
              <td class="whitespace-nowrap">
                <button nz-button nzSize="small" (click)="edit(campaign)">{{ 'marketing.action.edit' | translate }}</button>
                <a nz-button nzSize="small" routerLink="/marketing-automation/designer" [queryParams]="{ campaign: campaign.id }">{{ 'marketing.tab.designer' | translate }}</a>
                <a nz-button nzSize="small" routerLink="/marketing-automation/journey" [queryParams]="{ campaign: campaign.id }">{{ 'marketing.tab.journey' | translate }}</a>
                <button nz-button nzSize="small" (click)="insights(campaign)">{{ 'marketing.campaigns.insights' | translate }}</button>
                @for (action of actions(campaign); track action) {
                  <button nz-button nzSize="small" (click)="move(campaign, action)" [disabled]="store.saving()">{{ 'marketing.action.' + action | translate }}</button>
                }
                @if (campaign.status === 'draft') {
                  <button nz-button nzSize="small" nzDanger (click)="store.deleteCampaign(campaign.id)">{{ 'marketing.action.delete' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (selectedId()) {
      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        <nz-card [nzTitle]="'marketing.campaigns.step_logs' | translate">
          <nz-table #logs [nzData]="store.stepLogs()" nzSize="small" [nzPageSize]="10">
            <thead>
              <tr>
                <th>{{ 'marketing.logs.when' | translate }}</th>
                <th>{{ 'marketing.logs.step' | translate }}</th>
                <th>{{ 'marketing.logs.outcome' | translate }}</th>
                <th>{{ 'marketing.logs.detail' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs.data; track log.id) {
                <tr>
                  <td>{{ log.executed_at | date: 'short' }}</td>
                  <td>{{ 'marketing.step.' + log.type | translate }} ({{ log.step_key }})</td>
                  <td>{{ 'marketing.outcome.' + log.outcome | translate }}</td>
                  <td>
                    @if (reason(log.detail); as key) {
                      {{ key | translate }}
                    } @else {
                      {{ log.detail }}
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <nz-card [nzTitle]="'marketing.campaigns.ab_stats' | translate">
          @if (store.abStats(); as stats) {
            @if (stats.variants.length === 0) {
              <p class="text-gray-500">{{ 'marketing.ab.empty' | translate }}</p>
            } @else {
              <p class="mb-2 text-sm">
                {{ 'marketing.ab.criteria' | translate }}: <strong>{{ 'marketing.ab.' + stats.criteria | translate }}</strong>
                @if (stats.winner) {
                  · {{ 'marketing.ab.winner' | translate }}: <nz-tag nzColor="green">{{ stats.winner }}</nz-tag>
                }
              </p>
              <nz-table #ab [nzData]="stats.variants" nzSize="small" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'marketing.ab.variant' | translate }}</th>
                    <th>{{ 'marketing.kpi.sent' | translate }}</th>
                    <th>{{ 'marketing.ab.open_rate' | translate }}</th>
                    <th>{{ 'marketing.ab.click_rate' | translate }}</th>
                    <th>{{ 'marketing.ab.revenue' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (variant of ab.data; track variant.variant) {
                    <tr>
                      <td>{{ variant.variant }}</td>
                      <td>{{ variant.sent }}</td>
                      <td>{{ variant.open_rate | number: '1.0-1' }} %</td>
                      <td>{{ variant.click_rate | number: '1.0-1' }} %</td>
                      <td>{{ variant.revenue | number: '1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
          }
        </nz-card>
      </div>
    }
  `,
})
export class MarketingCampaignsComponent implements OnInit {
  protected readonly store = inject(MarketingAutomationStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);

  protected readonly channels = CAMPAIGN_CHANNELS;
  protected readonly triggers = CAMPAIGN_TRIGGERS;
  protected readonly providers = MAIL_PROVIDERS;
  protected readonly form = signal<CampaignForm>(emptyForm());
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);

  ngOnInit(): void {
    void this.store.loadSegments();
    void this.store.loadCampaigns();
    // `?campaign=` opens the logs and A/B results of that campaign.
    const id = this.route.snapshot.queryParamMap.get('campaign');
    if (id) {
      this.selectedId.set(id);
      void this.store.loadCampaignInsights(id);
    }
  }

  protected set<K extends keyof CampaignForm>(field: K, value: CampaignForm[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  protected startNew(): void {
    this.editingId.set(null);
    this.form.set(emptyForm());
    this.editing.set(true);
  }

  protected edit(campaign: MarketingCampaign): void {
    this.editingId.set(campaign.id);
    this.form.set({
      name: campaign.name,
      channel: campaign.channel,
      trigger: campaign.trigger_type,
      segmentId: campaign.segment_id,
      senderName: campaign.sender_name ?? '',
      senderEmail: campaign.sender_email ?? '',
      senderAddress: campaign.sender_postal_address ?? '',
      provider: campaign.provider,
      attributionModel: campaign.attribution_model,
      windowDays: campaign.attribution_window_days,
      utm: campaign.utm_campaign_code ?? '',
      currency: campaign.currency,
      cost: campaign.campaign_cost,
      coupon: campaign.coupon_code ?? '',
    });
    this.editing.set(true);
  }

  protected actions(campaign: MarketingCampaign) {
    return allowedActions(campaign.status);
  }

  protected reason(detail: string | null): string | null {
    return auditReasonKey(detail);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    const payload: SaveCampaignPayload = {
      name: f.name.trim(),
      channel: f.channel,
      trigger_type: f.trigger,
      segment_id: f.segmentId,
      sender_name: f.senderName.trim() || null,
      sender_email: f.senderEmail.trim() || null,
      sender_postal_address: f.senderAddress.trim() || null,
      provider: f.provider,
      attribution_model: f.attributionModel,
      attribution_window_days: f.windowDays,
      utm_campaign_code: f.utm.trim() || null,
      currency: f.currency,
      campaign_cost: f.cost,
      coupon_code: f.coupon.trim() || null,
    };
    const saved = await this.store.saveCampaign(payload, this.editingId() ?? undefined);
    if (saved) {
      this.editing.set(false);
      this.message.success(this.i18n.translate('marketing.campaigns.saved'));
    }
  }

  protected async move(
    campaign: MarketingCampaign,
    action: 'activate' | 'schedule' | 'pause' | 'archive',
  ): Promise<void> {
    const updated = await this.store.transition(campaign.id, action);
    if (updated) {
      this.message.success(this.i18n.translate('marketing.campaigns.status_changed'));
    }
  }

  protected async insights(campaign: MarketingCampaign): Promise<void> {
    this.selectedId.set(campaign.id);
    await this.store.loadCampaignInsights(campaign.id);
  }
}
