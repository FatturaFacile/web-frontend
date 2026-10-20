import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { FormsModule } from '@angular/forms';
import { AppStore, AuthStore } from '@core';

@Component({
  selector: 'app-header',
  imports: [
    FormsModule,
    NzButtonModule,
    NzDropdownModule,
    NzSelectModule,
    NzTagModule,
    NzAvatarModule,
  ],
  template: `
    <header class="app-header">
      <div class="header-left">
        <button
          type="button"
          class="sidebar-toggle"
          (click)="appStore.toggleSidebar()"
          [title]="appStore.isCollapsed() ? 'Espandi menu' : 'Comprimi menu'"
        >
          <i [class]="appStore.isCollapsed() ? 'fa-solid fa-bars-staggered' : 'fa-solid fa-bars'"></i>
        </button>

        <!-- Multi-tenant selector -->
        <div class="tenant-selector">
          <nz-select
            [ngModel]="authStore.activeTenantId()"
            (ngModelChange)="onTenantChange($event)"
            nzSize="small"
            class="tenant-select"
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
            title="Giurisdizione Italia (SDI, F24, D.Lgs. 66)"
          >
            🇮🇹 IT
          </button>
          <button
            type="button"
            class="jurisdiction-pill"
            [class.active]="authStore.activeJurisdiction() === 'CH'"
            (click)="authStore.setJurisdiction('CH')"
            title="Giurisdizione Svizzera (QR-Bill, ArG, KMU)"
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
        >
          <nz-option nzValue="EUR" nzLabel="€ EUR" />
          <nz-option nzValue="CHF" nzLabel="CHF" />
        </nz-select>

        <!-- Locale Switcher -->
        <nz-select
          [ngModel]="authStore.activeLocale()"
          (ngModelChange)="authStore.setLocale($event)"
          nzSize="small"
          class="locale-select"
        >
          <nz-option nzValue="IT" nzLabel="🇮🇹 IT" />
          <nz-option nzValue="DE" nzLabel="🇩🇪 DE" />
          <nz-option nzValue="FR" nzLabel="🇫🇷 FR" />
          <nz-option nzValue="EN" nzLabel="🇬🇧 EN" />
        </nz-select>

        <!-- Dark/Light Theme Toggle -->
        <button
          type="button"
          class="action-btn theme-toggle"
          (click)="authStore.toggleTheme()"
          [title]="authStore.isDarkMode() ? 'Attiva tema chiaro' : 'Attiva tema scuro'"
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
              <li nz-menu-item (click)="router.navigate(['/settings'])">
                <i class="fa-solid fa-sliders fa-icon-spaced"></i> Preferenze ERP
              </li>
              <li nz-menu-divider></li>
              <li nz-menu-item (click)="logout()" class="logout-item">
                <i class="fa-solid fa-right-from-bracket fa-icon-spaced"></i> Disconnetti
              </li>
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
      border-bottom: 1px solid var(--border-color, #f0f0f0);
      box-shadow: 0 1px 4px rgba(0, 21, 41, 0.04);
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
      color: var(--text-primary, #333333);
      padding: 8px 10px;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .sidebar-toggle:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .tenant-select {
      min-width: 220px;
    }

    .currency-select {
      width: 90px;
    }

    .locale-select {
      width: 90px;
    }

    .jurisdiction-toggle {
      display: inline-flex;
      background: #eef2f6;
      padding: 2px;
      border-radius: 6px;
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
      color: #64748b;
    }

    .jurisdiction-pill.active {
      background: #ffffff;
      color: #1677ff;
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
      color: var(--text-primary, #333333);
      transition: all 0.2s;
    }

    .action-btn:hover {
      border-color: #1677ff;
      color: #1677ff;
    }

    .profile-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-primary, #333333);
      transition: background 0.2s;
    }

    .profile-link:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .avatar {
      background-color: #1677ff;
    }

    .user-name {
      font-size: 13px;
      font-weight: 500;
    }

    .dropdown-arrow {
      font-size: 10px;
      color: #94a3b8;
    }

    .user-info-panel {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 0;
    }

    .user-role {
      font-size: 11px;
      color: #64748b;
    }

    .tenant-active {
      font-size: 11px;
      color: #1677ff;
      font-weight: 500;
    }

    .logout-item {
      color: #ff4d4f !important;
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

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/auth/login']);
  }
}
