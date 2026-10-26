import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { FormsModule } from '@angular/forms';
import { AppStore, AuthStore, SupportedLanguage } from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-header',
  imports: [
    FormsModule,
    NzButtonModule,
    NzDropdownModule,
    NzSelectModule,
    NzTagModule,
    NzAvatarModule,
    TranslatePipe,
  ],
  template: `
    <header class="app-header">
      <div class="header-left">
        <button
          type="button"
          class="sidebar-toggle"
          (click)="appStore.toggleSidebar()"
          [title]="
            appStore.isCollapsed()
              ? ('HEADER.TOGGLE_SIDEBAR_EXPAND' | translate)
              : ('HEADER.TOGGLE_SIDEBAR_COLLAPSE' | translate)
          "
          [attr.aria-label]="
            appStore.isCollapsed()
              ? ('HEADER.TOGGLE_SIDEBAR_EXPAND' | translate)
              : ('HEADER.TOGGLE_SIDEBAR_COLLAPSE' | translate)
          "
        >
          <i
            [class]="appStore.isCollapsed() ? 'fa-solid fa-bars-staggered' : 'fa-solid fa-bars'"
          ></i>
        </button>

        <!-- Multi-tenant selector -->
        <div class="tenant-selector">
          <nz-select
            [ngModel]="authStore.activeTenantId()"
            (ngModelChange)="onTenantChange($event)"
            nzSize="small"
            class="tenant-select"
            [attr.aria-label]="'AUTH.TENANT_PRESET' | translate"
          >
            @for (tenant of authStore.tenants(); track tenant.id) {
              <nz-option
                [nzValue]="tenant.id"
                [nzLabel]="tenant.name + ' (' + tenant.jurisdiction + ')'"
              />
            }
          </nz-select>
        </div>
      </div>

      <div class="header-right">
        <!-- Jurisdiction Switcher -->
        <div class="jurisdiction-toggle">
          <button
            type="button"
            class="jurisdiction-pill"
            [class.active]="authStore.activeJurisdiction() === 'IT'"
            (click)="authStore.setJurisdiction('IT')"
            [title]="'HEADER.JURISDICTION_IT' | translate"
            [attr.aria-label]="'HEADER.JURISDICTION_IT' | translate"
          >
            🇮🇹 IT
          </button>
          <button
            type="button"
            class="jurisdiction-pill"
            [class.active]="authStore.activeJurisdiction() === 'CH'"
            (click)="authStore.setJurisdiction('CH')"
            [title]="'HEADER.JURISDICTION_CH' | translate"
            [attr.aria-label]="'HEADER.JURISDICTION_CH' | translate"
          >
            🇨🇭 CH
          </button>
        </div>

        <!-- Currency Selector -->
        <nz-select
          [ngModel]="authStore.activeCurrency()"
          (ngModelChange)="authStore.setCurrency($event)"
          nzSize="small"
          class="currency-select"
          [attr.aria-label]="'SWISS_QR.CURRENCY_LBL' | translate"
        >
          <nz-option nzValue="EUR" nzLabel="€ EUR" />
          <nz-option nzValue="CHF" nzLabel="CHF" />
        </nz-select>

        <!-- Locale Switcher (en default, it, de, fr) -->
        <nz-select
          [ngModel]="authStore.activeLocale()"
          (ngModelChange)="onLocaleChange($event)"
          nzSize="small"
          class="locale-select"
          aria-label="Language selector"
        >
          <nz-option nzValue="en" nzLabel="🇬🇧 EN" />
          <nz-option nzValue="it" nzLabel="🇮🇹 IT" />
          <nz-option nzValue="de" nzLabel="🇩🇪 DE" />
          <nz-option nzValue="fr" nzLabel="🇫🇷 FR" />
        </nz-select>

        <!-- Dark/Light Theme Toggle -->
        <button
          type="button"
          class="action-btn theme-toggle"
          (click)="authStore.toggleTheme()"
          [title]="
            authStore.isDarkMode()
              ? ('HEADER.THEME_LIGHT' | translate)
              : ('HEADER.THEME_DARK' | translate)
          "
          [attr.aria-label]="
            authStore.isDarkMode()
              ? ('HEADER.THEME_LIGHT' | translate)
              : ('HEADER.THEME_DARK' | translate)
          "
        >
          @if (authStore.isDarkMode()) {
            <i class="fa-solid fa-sun" style="color: #fadb14;"></i>
          } @else {
            <i class="fa-solid fa-moon"></i>
          }
        </button>

        <!-- User profile dropdown -->
        <div class="user-profile">
          <a nz-dropdown [nzDropdownMenu]="userMenu" nzPlacement="bottomRight" class="profile-link">
            <nz-avatar
              nzSize="small"
              [nzSrc]="authStore.user()?.avatar ?? ''"
              nzIcon="user"
              class="avatar"
            />
            <span class="user-name">{{ authStore.user()?.name }}</span>
            <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
          </a>
          <nz-dropdown-menu #userMenu="nzDropdownMenu">
            <ul nz-menu class="user-menu-dropdown">
              <li nz-menu-item nzDisabled>
                <div class="user-info-panel">
                  <strong>{{ authStore.user()?.name }}</strong>
                  <span class="user-role">{{ authStore.user()?.role }}</span>
                  <span class="tenant-active">{{ authStore.activeTenant().name }}</span>
                </div>
              </li>
              <li nz-menu-divider></li>
              <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
              <li nz-menu-item (click)="router.navigate(['/settings'])">
                <i class="fa-solid fa-sliders fa-icon-spaced"></i>
                {{ 'HEADER.PREFERENCES' | translate }}
              </li>
              <li nz-menu-divider></li>
              <li nz-menu-item (click)="logout()" class="logout-item">
                <i class="fa-solid fa-right-from-bracket fa-icon-spaced"></i>
                {{ 'HEADER.LOGOUT' | translate }}
              </li>
              <!-- eslint-enable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            </ul>
          </nz-dropdown-menu>
        </div>
      </div>
    </header>
  `,
  styles: `
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 20px;
      background: var(--header-bg, #ffffff);
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      gap: 16px;
    }

    .header-left,
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-toggle {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--text-primary, #0f172a);
      padding: 8px 10px;
      border-radius: 6px;
      transition:
        background 0.2s,
        color 0.2s;
    }

    .sidebar-toggle:hover {
      background: rgba(13, 148, 136, 0.1);
      color: var(--primary-color, #0d9488);
    }

    .tenant-select {
      min-width: 220px;
    }

    .currency-select {
      width: 90px;
    }

    .locale-select {
      width: 92px;
    }

    .jurisdiction-toggle {
      display: inline-flex;
      background: var(--bg-card-secondary, #f1f5f9);
      padding: 2px;
      border-radius: 6px;
      border: 1px solid var(--border-color, #e2e8f0);
    }

    .jurisdiction-pill {
      border: none;
      background: transparent;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary, #64748b);
    }

    .jurisdiction-pill.active {
      background: var(--bg-card, #ffffff);
      color: var(--primary-color, #0d9488);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .action-btn {
      background: none;
      border: 1px solid var(--border-color, #e2e8f0);
      width: 34px;
      height: 34px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-primary, #0f172a);
      transition: all 0.2s;
    }

    .action-btn:hover {
      border-color: var(--primary-color, #0d9488);
      color: var(--primary-color, #0d9488);
      background: rgba(13, 148, 136, 0.08);
    }

    .profile-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-primary, #0f172a);
      transition: background 0.2s;
    }

    .profile-link:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .avatar {
      background-color: var(--primary-color, #0d9488);
    }

    .user-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #0f172a);
    }

    .dropdown-arrow {
      font-size: 10px;
      color: var(--text-secondary, #94a3b8);
    }

    .user-info-panel {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 0;
    }

    .user-role {
      font-size: 11px;
      color: var(--text-secondary, #64748b);
    }

    .tenant-active {
      font-size: 11px;
      color: var(--primary-color, #0d9488);
      font-weight: 600;
    }

    .logout-item {
      color: #ef4444 !important;
    }
  `,
})
export class HeaderComponent {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  readonly router = inject(Router);

  onTenantChange(tenantId: string): void {
    this.authStore.switchTenant(tenantId);
  }

  onLocaleChange(locale: SupportedLanguage): void {
    this.authStore.setLocale(locale);
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
