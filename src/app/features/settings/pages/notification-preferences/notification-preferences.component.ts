import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationDevice,
  NotificationFrequency,
  NotificationPreferences,
  NotificationSettings,
  PlatformApiService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AlertRulesComponent } from './alert-rules.component';
import { DeliveryLogComponent } from './delivery-log.component';
import { ScheduledErpReportComponent } from './scheduled-erp-report.component';

/** Per-channel switches and delivery frequency of each notification category, plus the do-not-disturb settings. */
@Component({
  selector: 'app-notification-preferences',
  imports: [AlertRulesComponent, DeliveryLogComponent, ScheduledErpReportComponent, FormsModule, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzSwitchModule, NzTableModule],
  template: `
    <app-page-header [title]="'PLATFORM.NOTIFICATION_PREFERENCES' | translate" [subtitle]="'PLATFORM.NOTIFICATION_PREFERENCES_SUBTITLE' | translate"></app-page-header>

    <app-scheduled-erp-report />

    <nz-card>
      @if (state(); as current) {
        <nz-table [nzData]="current.categories" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'PLATFORM.CATEGORY' | translate }}</th>
              @for (channel of current.channels; track channel) {
                <th>{{ 'PLATFORM.CHANNEL_' + channel.toUpperCase() | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (category of current.categories; track category) {
              <tr>
                <td>{{ 'PLATFORM.CATEGORY_' + category.toUpperCase() | translate }}</td>
                @for (channel of current.channels; track channel) {
                  <td>
                    <nz-switch
                      [ngModel]="isEnabled(channel, category)"
                      (ngModelChange)="setEnabled(channel, category, $event)"
                      [attr.aria-label]="('PLATFORM.CHANNEL_' + channel.toUpperCase() | translate) + ' - ' + ('PLATFORM.CATEGORY_' + category.toUpperCase() | translate)"
                    ></nz-switch>
                    @if (channel !== 'database' && isEnabled(channel, category)) {
                      <select
                        class="frequency"
                        [ngModel]="frequency(channel, category)"
                        (ngModelChange)="setFrequency(channel, category, $event)"
                        [attr.aria-label]="('PLATFORM.FREQUENCY' | translate) + ': ' + ('PLATFORM.CHANNEL_' + channel.toUpperCase() | translate) + ' - ' + ('PLATFORM.CATEGORY_' + category.toUpperCase() | translate)"
                      >
                        <option value="immediate">{{ 'PLATFORM.FREQUENCY_IMMEDIATE' | translate }}</option>
                        <option value="digest">{{ 'PLATFORM.FREQUENCY_DIGEST' | translate }}</option>
                      </select>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
        <div class="footer">
          <button nz-button nzType="primary" type="button" [nzLoading]="saving()" (click)="save()">{{ 'PLATFORM.SAVE' | translate }}</button>
        </div>
      }
    </nz-card>

    @if (settings(); as dnd) {
      <nz-card class="dnd" [nzTitle]="'PLATFORM.DND_TITLE' | translate">
        <p class="hint">{{ 'PLATFORM.DND_HINT' | translate }}</p>
        <div class="row">
          <nz-switch [ngModel]="dnd.quiet_hours_enabled" (ngModelChange)="patchSettings({ quiet_hours_enabled: $event })" [attr.aria-label]="'PLATFORM.QUIET_HOURS_ENABLED' | translate"></nz-switch>
          <span>{{ 'PLATFORM.QUIET_HOURS_ENABLED' | translate }}</span>
        </div>
        @if (dnd.quiet_hours_enabled) {
          <div class="row">
            <label>
              {{ 'PLATFORM.QUIET_FROM' | translate }}
              <input type="time" [ngModel]="dnd.quiet_start" (ngModelChange)="patchSettings({ quiet_start: $event })" />
            </label>
            <label>
              {{ 'PLATFORM.QUIET_TO' | translate }}
              <input type="time" [ngModel]="dnd.quiet_end" (ngModelChange)="patchSettings({ quiet_end: $event })" />
            </label>
            <span class="tz">{{ 'PLATFORM.TIMEZONE' | translate }}: {{ dnd.timezone }}</span>
          </div>
        }
        <div class="row">
          @if (snoozedUntil(); as until) {
            <span>{{ 'PLATFORM.SNOOZED_UNTIL' | translate }} {{ until }}</span>
            <button nz-button type="button" (click)="snooze(null)">{{ 'PLATFORM.SNOOZE_CLEAR' | translate }}</button>
          } @else {
            <span>{{ 'PLATFORM.SNOOZE' | translate }}</span>
            <button nz-button type="button" (click)="snooze(1)">{{ 'PLATFORM.SNOOZE_1H' | translate }}</button>
            <button nz-button type="button" (click)="snooze(8)">{{ 'PLATFORM.SNOOZE_8H' | translate }}</button>
          }
        </div>
        <div class="footer">
          <button nz-button nzType="primary" type="button" [nzLoading]="savingSettings()" (click)="saveSettings()">{{ 'PLATFORM.SAVE' | translate }}</button>
        </div>
      </nz-card>
    }

    @if (settings(); as channels) {
      <nz-card class="dnd" [nzTitle]="'PLATFORM.CHANNELS_TITLE' | translate">
        <div class="row">
          <strong>Telegram</strong>
          @if (channels.telegram_linked) {
            <span>{{ 'PLATFORM.TELEGRAM_LINKED' | translate }}</span>
            <button nz-button type="button" (click)="unlinkTelegram()">{{ 'PLATFORM.TELEGRAM_UNLINK' | translate }}</button>
          } @else {
            <button nz-button type="button" (click)="linkTelegram()">{{ 'PLATFORM.TELEGRAM_LINK' | translate }}</button>
          }
        </div>
        <div class="row">
          <label>
            WhatsApp
            <input type="tel" placeholder="+41791234567" [ngModel]="channels.whatsapp_number ?? ''" (ngModelChange)="patchSettings({ whatsapp_number: $event || null })" />
          </label>
          <button nz-button type="button" [nzLoading]="savingSettings()" (click)="saveSettings()">{{ 'PLATFORM.SAVE' | translate }}</button>
        </div>
        <div class="row">
          <strong>{{ 'PLATFORM.DEVICES' | translate }}</strong>
          @if (devices().length === 0) {
            <span>{{ 'PLATFORM.NO_DEVICES' | translate }}</span>
          }
          @for (device of devices(); track device.id) {
            <span>{{ device.name ?? device.platform }}</span>
            <button nz-button nzSize="small" type="button" (click)="removeDevice(device.id)">{{ 'PLATFORM.DELETE' | translate }}</button>
          }
        </div>
      </nz-card>
    }

    <app-alert-rules class="block" />
    <app-delivery-log class="block" />
  `,
  styles: `
    .footer {
      margin-top: 16px;
    }
    .dnd {
      margin-top: 16px;
    }
    .block {
      display: block;
      margin-top: 16px;
    }
    .hint {
      color: var(--text-secondary);
    }
    .row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
    }
    .frequency {
      margin-left: 8px;
      font: inherit;
    }
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly state = signal<NotificationPreferences | null>(null);
  readonly settings = signal<NotificationSettings | null>(null);
  readonly devices = signal<NotificationDevice[]>([]);
  readonly saving = signal(false);
  readonly savingSettings = signal(false);

  /** The snooze end as a local date-time string while it is still in the future, otherwise null. */
  readonly snoozedUntil = computed(() => {
    const until = this.settings()?.muted_until;
    if (!until || new Date(until).getTime() <= Date.now()) {
      return null;
    }
    return new Date(until).toLocaleString();
  });

  ngOnInit(): void {
    this.api.getNotificationPreferences().subscribe((res) => this.state.set(res.data));
    this.api.getNotificationSettings().subscribe((res) => this.settings.set(res.data));
    this.loadDevices();
  }

  isEnabled(channel: NotificationChannel, category: NotificationCategory): boolean {
    return this.state()?.preferences.find((p) => p.channel === channel && p.category === category)?.enabled ?? true;
  }

  frequency(channel: NotificationChannel, category: NotificationCategory): NotificationFrequency {
    return this.state()?.preferences.find((p) => p.channel === channel && p.category === category)?.frequency ?? 'immediate';
  }

  setEnabled(channel: NotificationChannel, category: NotificationCategory, enabled: boolean): void {
    this.patchPreference(channel, category, { enabled });
  }

  setFrequency(channel: NotificationChannel, category: NotificationCategory, frequency: NotificationFrequency): void {
    this.patchPreference(channel, category, { frequency });
  }

  patchSettings(changes: Partial<NotificationSettings>): void {
    const current = this.settings();
    if (current !== null) {
      this.settings.set({ ...current, ...changes });
    }
  }

  /** Snoozes all notifications for the given number of hours, or resumes them when null. Saved right away. */
  snooze(hours: number | null): void {
    const until = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
    this.patchSettings({ muted_until: until });
    this.saveSettings();
  }

  save(): void {
    const current = this.state();
    if (current === null) {
      return;
    }
    this.saving.set(true);
    this.api.updateNotificationPreferences({ preferences: current.preferences }).subscribe({
      next: (res) => {
        this.state.set(res.data);
        this.saving.set(false);
        this.message.success(this.translate.instant('PLATFORM.SAVED'));
      },
      error: () => this.saving.set(false),
    });
  }

  saveSettings(): void {
    const current = this.settings();
    if (current === null) {
      return;
    }
    this.savingSettings.set(true);
    // An expired snooze is dropped: the API only accepts a snooze that ends in the future.
    const body = this.snoozedUntil() === null ? { ...current, muted_until: null } : current;
    this.api.updateNotificationSettings(body).subscribe({
      next: (res) => {
        this.settings.set(res.data);
        this.savingSettings.set(false);
        this.message.success(this.translate.instant('PLATFORM.SAVED'));
      },
      error: () => this.savingSettings.set(false),
    });
  }

  /** Opens the Telegram deep link; pressing Start in the bot links the chat. */
  linkTelegram(): void {
    this.api.linkTelegram().subscribe((res) => {
      window.open(res.data.url, '_blank', 'noopener');
      // The webhook links the chat asynchronously: refresh the state once the user is back.
      window.addEventListener('focus', () => this.refreshSettings(), { once: true });
    });
  }

  unlinkTelegram(): void {
    this.api.unlinkTelegram().subscribe(() => this.refreshSettings());
  }

  removeDevice(id: string): void {
    this.api.deleteNotificationDevice(id).subscribe(() => this.loadDevices());
  }

  private loadDevices(): void {
    this.api.getNotificationDevices().subscribe((res) => this.devices.set(res.data));
  }

  private refreshSettings(): void {
    this.api.getNotificationSettings().subscribe((res) => this.settings.set(res.data));
  }

  private patchPreference(
    channel: NotificationChannel,
    category: NotificationCategory,
    changes: { enabled?: boolean; frequency?: NotificationFrequency },
  ): void {
    const current = this.state();
    if (current === null) {
      return;
    }
    this.state.set({
      ...current,
      preferences: current.preferences.map((p) => (p.channel === channel && p.category === category ? { ...p, ...changes } : p)),
    });
  }
}
