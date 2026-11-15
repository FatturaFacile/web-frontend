import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NotificationCategory, NotificationChannel, NotificationPreferences, PlatformApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Per-channel switches of each notification category of the signed-in user. */
@Component({
  selector: 'app-notification-preferences',
  imports: [FormsModule, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzSwitchModule, NzTableModule],
  template: `
    <app-page-header [title]="'PLATFORM.NOTIFICATION_PREFERENCES' | translate" [subtitle]="'PLATFORM.NOTIFICATION_PREFERENCES_SUBTITLE' | translate"></app-page-header>

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
  `,
  styles: `
    .footer {
      margin-top: 16px;
    }
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly state = signal<NotificationPreferences | null>(null);
  readonly saving = signal(false);

  ngOnInit(): void {
    this.api.getNotificationPreferences().subscribe((res) => this.state.set(res.data));
  }

  isEnabled(channel: NotificationChannel, category: NotificationCategory): boolean {
    return this.state()?.preferences.find((p) => p.channel === channel && p.category === category)?.enabled ?? true;
  }

  setEnabled(channel: NotificationChannel, category: NotificationCategory, enabled: boolean): void {
    const current = this.state();
    if (current === null) {
      return;
    }
    this.state.set({
      ...current,
      preferences: current.preferences.map((p) => (p.channel === channel && p.category === category ? { ...p, enabled } : p)),
    });
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
}
