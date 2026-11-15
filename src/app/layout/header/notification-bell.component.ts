import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { interval } from 'rxjs';
// Deep imports keep the `@core` and `@shared` barrels out of the initial bundle (the header is part of it).
import { PlatformApiService } from '@core/api/platform-api.service';
import type { PlatformNotification } from '@core/models/platform.model';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

const POLL_INTERVAL_MS = 60_000;

/**
 * The bell of the layout header: unread count (refreshed every minute) and a dropdown with the latest notifications of
 * the user, which can be marked read one by one or all at once. Links to the notification preferences.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe, RouterLink, NzBadgeModule, NzDropdownModule, TranslatePipe],
  template: `
    <button
      type="button"
      class="action-btn notification-bell"
      nz-dropdown
      nzTrigger="click"
      nzPlacement="bottomRight"
      [nzDropdownMenu]="panel"
      (nzVisibleChange)="onVisibleChange($event)"
      [title]="'PLATFORM.NOTIFICATIONS' | translate"
      [attr.aria-label]="'PLATFORM.NOTIFICATIONS' | translate"
    >
      <nz-badge [nzCount]="unreadCount()" [nzOverflowCount]="99" nzSize="small">
        <i class="fa-solid fa-bell" aria-hidden="true"></i>
      </nz-badge>
    </button>
    <nz-dropdown-menu #panel="nzDropdownMenu">
      <div class="notification-panel">
        <div class="notification-panel-head">
          <strong>{{ 'PLATFORM.NOTIFICATIONS' | translate }}</strong>
          <button type="button" class="link-btn" [disabled]="unreadCount() === 0" (click)="markAllRead()">
            {{ 'PLATFORM.MARK_ALL_READ' | translate }}
          </button>
        </div>
        @if (notifications().length === 0) {
          <p class="notification-empty">{{ 'PLATFORM.NO_NOTIFICATIONS' | translate }}</p>
        } @else {
          <ul class="notification-list">
            @for (item of notifications(); track item.id) {
              <li [class.unread]="!item.read_at">
                <button type="button" class="notification-item" (click)="open(item)">
                  <span class="notification-title">{{ item.data.title ?? item.data.message ?? item.type }}</span>
                  @if (item.data.title && item.data.message) {
                    <span class="notification-text">{{ item.data.message }}</span>
                  }
                  <span class="notification-time">{{ item.created_at | date: 'short' }}</span>
                </button>
              </li>
            }
          </ul>
        }
        <div class="notification-panel-foot">
          <a routerLink="/settings/notifications">{{ 'PLATFORM.NOTIFICATION_PREFERENCES' | translate }}</a>
        </div>
      </div>
    </nz-dropdown-menu>
  `,
  styles: `
    .notification-panel {
      width: 340px;
      max-width: 90vw;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--card-shadow);
    }
    .notification-panel-head,
    .notification-panel-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
    }
    .notification-panel-head {
      border-bottom: 1px solid var(--border-color);
    }
    .link-btn {
      border: 0;
      background: transparent;
      color: var(--primary-color);
      cursor: pointer;
    }
    .link-btn:disabled {
      color: var(--text-secondary);
      cursor: default;
    }
    .notification-list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 360px;
      overflow-y: auto;
    }
    .notification-list li.unread {
      background: var(--bg-selected);
    }
    .notification-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: 0;
      background: transparent;
      text-align: left;
      color: var(--text-primary);
      cursor: pointer;
    }
    .notification-item:hover {
      background: var(--bg-hover);
    }
    .notification-title {
      font-weight: 600;
    }
    .notification-text,
    .notification-time {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
    .notification-empty {
      margin: 0;
      padding: var(--space-4);
      text-align: center;
      color: var(--text-secondary);
    }
    .notification-panel-foot {
      border-top: 1px solid var(--border-color);
    }
  `,
})
export class NotificationBellComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly notifications = signal<PlatformNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  ngOnInit(): void {
    this.refresh();
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  onVisibleChange(visible: boolean): void {
    if (visible) {
      this.refresh();
    }
  }

  open(item: PlatformNotification): void {
    if (!item.read_at) {
      this.api.markNotificationRead(item.id).subscribe(() => this.refresh());
    }
    const url = item.data.url;
    if (typeof url === 'string' && url.startsWith('/')) {
      void this.router.navigateByUrl(url);
    }
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe(() => this.refresh());
  }

  private refresh(): void {
    this.api.getNotifications(false, 10).subscribe({
      next: (res) => {
        this.notifications.set(res.data);
        this.unreadCount.set(res.unread_count ?? 0);
      },
      // The bell is passive: a failed refresh keeps the last state, the error interceptor already informs the user.
      error: () => undefined,
    });
  }
}
