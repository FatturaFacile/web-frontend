import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, MarketingConsent, UpdateConsentPayload } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MarketingNavComponent } from './marketing-nav.component';
import { MarketingAutomationStore } from './marketing-automation.store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Granular consent toggles, the compliance strategy of each jurisdiction (CH LCSl/nLPD, IT GDPR Art. 130) and the audit log. */
@Component({
  selector: 'app-consent-compliance',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MarketingNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'marketing.consent.title' | translate"
      [subtitle]="'marketing.consent.subtitle' | translate"
    />
    <app-marketing-nav activeTab="consent" />

    @if (store.errorCode(); as code) {
      <p class="mb-4 text-red-600" role="alert">{{ code | translate }}</p>
    }

    <section class="mb-4 grid gap-4 md:grid-cols-2" [attr.aria-label]="'marketing.consent.strategies' | translate">
      @for (strategy of store.strategies(); track strategy.code) {
        <nz-card nzSize="small" [nzTitle]="'marketing.strategy.' + strategy.code | translate" class="strategy-card">
          <p class="mb-2 text-sm">{{ 'marketing.strategy.' + strategy.code + '.summary' | translate }}</p>
          <p class="mb-2 text-xs text-gray-500">
            {{ 'marketing.consent.jurisdictions' | translate }}:
            @for (jurisdiction of strategy.jurisdictions; track jurisdiction) {
              <nz-tag>{{ jurisdiction }}</nz-tag>
            }
          </p>
          <ul class="list-disc pl-5 text-xs text-gray-600">
            <li>{{ 'marketing.strategy.' + strategy.code + '.rule_consent' | translate }}</li>
            <li>{{ 'marketing.strategy.' + strategy.code + '.rule_soft' | translate }}</li>
            <li>{{ 'marketing.strategy.' + strategy.code + '.rule_unsubscribe' | translate }}</li>
          </ul>
        </nz-card>
      }
    </section>

    <nz-card class="mb-4" [nzTitle]="'marketing.consent.record' | translate">
      <div class="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,auto)]">
        <div>
          <label class="mb-1 block text-xs font-medium" for="consent-contact">{{ 'marketing.consent.contact_id' | translate }}</label>
          <input nz-input id="consent-contact" [ngModel]="contactId()" (ngModelChange)="contactId.set($event.trim())" placeholder="00000000-0000-0000-0000-000000000000" />
        </div>
        <label class="flex items-center gap-2 text-sm"><nz-switch [ngModel]="marketing()" (ngModelChange)="marketing.set($event)" />{{ 'marketing.consent.marketing' | translate }}</label>
        <label class="flex items-center gap-2 text-sm"><nz-switch [ngModel]="profiling()" (ngModelChange)="profiling.set($event)" />{{ 'marketing.consent.profiling' | translate }}</label>
        <label class="flex items-center gap-2 text-sm"><nz-switch [ngModel]="soft()" (ngModelChange)="soft.set($event)" />{{ 'marketing.consent.soft_opt_in' | translate }}</label>
        <label class="flex items-center gap-2 text-sm"><nz-switch [ngModel]="doubleOptIn()" (ngModelChange)="doubleOptIn.set($event)" />{{ 'marketing.consent.double_opt_in' | translate }}</label>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-4">
        <span class="text-xs font-medium">{{ 'marketing.consent.channels' | translate }}</span>
        @for (channel of channels; track channel) {
          <label class="flex items-center gap-2 text-sm">
            <nz-switch [ngModel]="channelOn(channel)" (ngModelChange)="setChannel(channel, $event)" />
            {{ 'marketing.consent.channel_' + channel | translate }}
          </label>
        }
      </div>
      <div class="mt-4 flex gap-2">
        <button nz-button nzType="primary" (click)="save()" [disabled]="!validContact() || store.saving()">{{ 'marketing.action.save' | translate }}</button>
        <button nz-button (click)="showEvents()" [disabled]="!validContact()">{{ 'marketing.consent.show_audit' | translate }}</button>
      </div>
      @if (!validContact() && contactId() !== '') {
        <p class="mt-2 text-xs text-red-600" role="alert">{{ 'marketing.consent.invalid_contact' | translate }}</p>
      }
    </nz-card>

    <div class="grid gap-4 xl:grid-cols-2">
      <nz-card [nzTitle]="'marketing.consent.states' | translate">
        <nz-table #states [nzData]="store.consents()" [nzLoading]="store.loading()" nzSize="small" [nzPageSize]="10">
          <thead>
            <tr>
              <th>{{ 'marketing.consent.contact_id' | translate }}</th>
              <th>{{ 'marketing.consent.marketing' | translate }}</th>
              <th>{{ 'marketing.consent.profiling' | translate }}</th>
              <th>{{ 'marketing.consent.soft_opt_in' | translate }}</th>
              <th>{{ 'marketing.field.locale' | translate }}</th>
              <th>{{ 'marketing.consent.unsubscribed' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of states.data; track row.contact_id) {
              <tr>
                <td><button type="button" class="underline" (click)="open(row)">{{ row.contact_id.slice(0, 8) }}…</button></td>
                <td>{{ (row.marketing_opt_in ? 'marketing.common.yes' : 'marketing.common.no') | translate }}</td>
                <td>{{ (row.profiling_opt_in ? 'marketing.common.yes' : 'marketing.common.no') | translate }}</td>
                <td>{{ (row.soft_opt_in_eligible ? 'marketing.common.yes' : 'marketing.common.no') | translate }}</td>
                <td>{{ row.locale.toUpperCase() }}</td>
                <td>
                  @if (row.unsubscribed_at) {
                    <nz-tag nzColor="red">{{ row.unsubscribed_at | date: 'short' }}</nz-tag>
                  } @else {
                    —
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card [nzTitle]="'marketing.consent.audit_log' | translate">
        <p class="mb-2 text-xs text-gray-500">{{ 'marketing.consent.audit_hint' | translate }}</p>
        <nz-table #events [nzData]="store.consentEvents()" nzSize="small" [nzPageSize]="10">
          <thead>
            <tr>
              <th>{{ 'marketing.logs.when' | translate }}</th>
              <th>{{ 'marketing.consent.event' | translate }}</th>
              <th>{{ 'marketing.consent.lawful_basis' | translate }}</th>
              <th>{{ 'marketing.consent.strategy' | translate }}</th>
              <th>{{ 'marketing.consent.source' | translate }}</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            @for (event of events.data; track event.id) {
              <tr>
                <td>{{ event.occurred_at | date: 'short' }}</td>
                <td>{{ 'marketing.event.' + event.event_type | translate }}</td>
                <td>{{ event.lawful_basis ? ('marketing.basis.' + event.lawful_basis | translate) : '—' }}</td>
                <td>{{ event.strategy_code ? ('marketing.strategy.' + event.strategy_code | translate) : '—' }}</td>
                <td>{{ event.source ?? '—' }}</td>
                <td>{{ event.ip_address ?? '—' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
})
export class ConsentComplianceComponent implements OnInit {
  protected readonly store = inject(MarketingAutomationStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  protected readonly channels = ['email', 'whatsapp', 'sms'] as const;
  protected readonly contactId = signal('');
  protected readonly marketing = signal(false);
  protected readonly profiling = signal(false);
  protected readonly soft = signal(false);
  protected readonly doubleOptIn = signal(false);
  protected readonly channelPrefs = signal<Record<string, boolean>>({ email: true, whatsapp: true, sms: true });

  ngOnInit(): void {
    void this.store.loadConsents();
  }

  protected validContact(): boolean {
    return UUID.test(this.contactId());
  }

  protected channelOn(channel: string): boolean {
    return this.channelPrefs()[channel] !== false;
  }

  protected setChannel(channel: string, on: boolean): void {
    this.channelPrefs.update((prefs) => ({ ...prefs, [channel]: on }));
  }

  /** Loads the state of a consent row into the form. */
  protected open(row: MarketingConsent): void {
    this.contactId.set(row.contact_id);
    this.marketing.set(row.marketing_opt_in);
    this.profiling.set(row.profiling_opt_in);
    this.soft.set(row.soft_opt_in_eligible);
    this.doubleOptIn.set(row.double_opt_in_confirmed);
    this.channelPrefs.set({ email: true, whatsapp: true, sms: true, ...row.channel_preferences });
    void this.store.loadConsentEvents(row.contact_id);
  }

  protected showEvents(): void {
    void this.store.loadConsentEvents(this.contactId());
  }

  protected async save(): Promise<void> {
    const payload: UpdateConsentPayload = {
      marketing_opt_in: this.marketing(),
      profiling_opt_in: this.profiling(),
      soft_opt_in_eligible: this.soft(),
      double_opt_in_confirmed: this.doubleOptIn(),
      channel_preferences: this.channelPrefs(),
      source: 'backoffice',
    };
    const saved = await this.store.updateConsent(this.contactId(), payload);
    if (saved) {
      this.message.success(this.i18n.translate('marketing.consent.saved'));
    }
  }
}
