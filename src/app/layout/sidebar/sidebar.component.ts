import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AppStore } from '@core';
import { TranslatePipe } from '@shared';

interface MenuItem {
  key: string;
  icon: string;
  route?: string;
  children?: { key: string; route: string; icon: string }[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, NzMenuModule, NzTooltipModule, TranslatePipe],
  template: `
    <div class="sidebar-brand" [class.collapsed]="appStore.isCollapsed()">
      <img
        src="/images/fattura_facile_favicon_trasparente.svg"
        alt="Fattura Facile Logo"
        class="brand-logo"
      />
      @if (!appStore.isCollapsed()) {
        <span class="brand-text">Fattura <span style="color:#0D9488;">Facile</span></span>
      }
    </div>

    <ul
      nz-menu
      nzTheme="dark"
      nzMode="inline"
      [nzInlineCollapsed]="appStore.isCollapsed()"
      class="sidebar-menu"
      [class.sidebar-collapsed]="appStore.isCollapsed()"
    >
      @for (item of menuItems; track item.key) {
        @if (!item.children) {
          <li
            nz-menu-item
            nzMatchRouter
            [title]="item.key | translate"
            nz-tooltip
            [nzTooltipTitle]="appStore.isCollapsed() ? (item.key | translate) : null"
            [nzTooltipPlacement]="'right'"
          >
            <a
              [routerLink]="item.route"
              class="menu-item-link"
              [title]="item.key | translate"
            >
              <i [class]="item.icon + ' sidebar-icon'"></i>
              <span class="menu-title-text">{{ item.key | translate }}</span>
            </a>
          </li>
        } @else {
          <li
            nz-submenu
            [nzTitle]="submenuTitle"
            [title]="item.key | translate"
            nz-tooltip
            [nzTooltipTitle]="appStore.isCollapsed() ? (item.key | translate) : null"
            [nzTooltipPlacement]="'right'"
          >
            <ng-template #submenuTitle>
              <div class="submenu-title-wrapper" [title]="item.key | translate">
                <i [class]="item.icon + ' sidebar-icon'"></i>
                <span class="menu-title-text">{{ item.key | translate }}</span>
              </div>
            </ng-template>
            <ul>
              @for (sub of item.children; track sub.route) {
                <li
                  nz-menu-item
                  nzMatchRouter
                  [title]="sub.key | translate"
                  nz-tooltip
                  [nzTooltipTitle]="appStore.isCollapsed() ? (sub.key | translate) : null"
                  [nzTooltipPlacement]="'right'"
                >
                  <a
                    [routerLink]="sub.route"
                    class="menu-item-link"
                    [title]="sub.key | translate"
                  >
                    <i [class]="sub.icon + ' sidebar-icon'"></i>
                    <span class="menu-title-text">{{ sub.key | translate }}</span>
                  </a>
                </li>
              }
            </ul>
          </li>
        }
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--sidebar-bg, #0f172a);
    }

    .sidebar-brand {
      height: 64px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.25);
      border-bottom: 1px solid var(--sidebar-border, #1e293b);
      white-space: nowrap;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar-brand.collapsed {
      padding: 0;
      justify-content: center;
    }

    .brand-logo {
      height: 38px;
      width: 38px;
      object-fit: contain;
      flex-shrink: 0;
      transition: transform 0.2s;
    }

    .sidebar-brand:hover .brand-logo {
      transform: scale(1.05);
    }

    .brand-text {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .sidebar-menu {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      border-right: none;
      background: transparent !important;
    }

    .sidebar-menu::-webkit-scrollbar {
      width: 4px;
    }

    .sidebar-menu::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
    }

    .menu-item-link {
      display: flex;
      align-items: center;
      width: 100%;
      color: inherit;
      text-decoration: none;
    }

    .submenu-title-wrapper {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .sidebar-icon {
      font-size: 15px;
      width: 20px;
      margin-right: 12px;
      text-align: center;
      flex-shrink: 0;
      transition: margin 0.2s, font-size 0.2s;
    }

    .menu-title-text {
      font-size: 13px;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: opacity 0.2s, width 0.2s;
    }

    /* COLLAPSED MINI-SIDEBAR CLEAN STATE */
    .sidebar-collapsed {
      .menu-title-text {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        opacity: 0 !important;
        overflow: hidden !important;
      }

      .sidebar-icon {
        margin-right: 0 !important;
        width: 100% !important;
        font-size: 18px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .menu-item-link,
      .submenu-title-wrapper {
        justify-content: center !important;
        padding: 0 !important;
      }
    }

    /* Deep overrides for ng-zorro menu in collapsed mode */
    :host ::ng-deep {
      .ant-menu-dark {
        background: transparent;
      }

      .ant-menu-dark.ant-menu-inline .ant-menu-item-selected {
        background-color: var(--primary-color, #0d9488) !important;
        color: #ffffff !important;
      }

      .ant-menu-dark .ant-menu-item:hover,
      .ant-menu-dark .ant-menu-submenu-title:hover {
        color: #ffffff;
        background-color: rgba(255, 255, 255, 0.08);
      }

      .ant-menu-inline-collapsed > .ant-menu-item,
      .ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title {
        padding: 0 !important;
        text-align: center !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }

      .ant-menu-inline-collapsed .ant-menu-submenu-arrow {
        display: none !important;
      }

      .ant-menu-inline-collapsed .menu-title-text {
        display: none !important;
      }

      .ant-menu-inline-collapsed .sidebar-icon {
        margin: 0 !important;
        width: 100% !important;
      }
    }
  `,
})
export class SidebarComponent {
  readonly appStore = inject(AppStore);

  readonly menuItems: readonly MenuItem[] = [
    {
      key: 'NAV.DASHBOARD',
      icon: 'fa-solid fa-gauge-high',
      route: '/dashboard',
    },
    {
      key: 'NAV.CRM',
      icon: 'fa-solid fa-users',
      children: [
        { key: 'NAV.CLIENTS', route: '/crm/clients', icon: 'fa-solid fa-address-book' },
        { key: 'NAV.SUPPLIERS', route: '/crm/suppliers', icon: 'fa-solid fa-truck-field' },
      ],
    },
    {
      key: 'NAV.SALES',
      icon: 'fa-solid fa-file-invoice-dollar',
      children: [
        { key: 'NAV.ORDERS', route: '/sales/orders', icon: 'fa-solid fa-cart-shopping' },
        { key: 'NAV.SDI', route: '/sales/sdi', icon: 'fa-solid fa-receipt' },
        { key: 'NAV.QR_BILL', route: '/sales/qr-bill', icon: 'fa-solid fa-qrcode' },
      ],
    },
    {
      key: 'NAV.PURCHASES',
      icon: 'fa-solid fa-cart-flatbed',
      children: [
        { key: 'NAV.SDI_INBOX', route: '/purchases/sdi-inbox', icon: 'fa-solid fa-inbox' },
        {
          key: 'NAV.QR_SCANNER',
          route: '/purchases/qr-scanner',
          icon: 'fa-solid fa-file-import',
        },
        { key: 'NAV.EXPENSES', route: '/purchases/expenses', icon: 'fa-solid fa-wallet' },
      ],
    },
    {
      key: 'NAV.TREASURY',
      icon: 'fa-solid fa-building-columns',
      route: '/treasury',
    },
    {
      key: 'NAV.INVENTORY',
      icon: 'fa-solid fa-boxes-stacked',
      children: [
        { key: 'NAV.STOCK', route: '/inventory/stock', icon: 'fa-solid fa-warehouse' },
        { key: 'NAV.DDT', route: '/inventory/ddt', icon: 'fa-solid fa-truck-ramp-box' },
        { key: 'NAV.CUSTOMS', route: '/inventory/customs', icon: 'fa-solid fa-passport' },
      ],
    },
    {
      key: 'NAV.FIELD_SERVICE',
      icon: 'fa-solid fa-screwdriver-wrench',
      children: [
        {
          key: 'NAV.TICKETS',
          route: '/field-service/tickets',
          icon: 'fa-solid fa-ticket',
        },
        {
          key: 'NAV.REPORTS',
          route: '/field-service/reports',
          icon: 'fa-solid fa-screwdriver-wrench',
        },
      ],
    },
    {
      key: 'NAV.AUTOMOTIVE',
      icon: 'fa-solid fa-car',
      children: [
        { key: 'NAV.WORKSHOP', route: '/automotive/workshop', icon: 'fa-solid fa-wrench' },
        {
          key: 'NAV.TIRE_HOTEL',
          route: '/automotive/tire-hotel',
          icon: 'fa-solid fa-circle-dot',
        },
      ],
    },
    {
      key: 'NAV.RENT',
      icon: 'fa-solid fa-car-side',
      children: [
        { key: 'NAV.FLEET', route: '/rent/fleet', icon: 'fa-solid fa-calendar-week' },
        { key: 'NAV.APPRAISAL', route: '/rent/appraisal', icon: 'fa-solid fa-car-burst' },
      ],
    },
    {
      key: 'NAV.CONSTRUCTION',
      icon: 'fa-solid fa-person-digging',
      route: '/construction',
    },
    {
      key: 'NAV.PROFESSIONALS',
      icon: 'fa-solid fa-scale-balanced',
      route: '/professionals',
    },
    {
      key: 'NAV.MANUFACTURING',
      icon: 'fa-solid fa-industry',
      route: '/manufacturing',
    },
    {
      key: 'NAV.RETAIL',
      icon: 'fa-solid fa-cash-register',
      route: '/retail',
    },
    {
      key: 'NAV.TIME_ATTENDANCE',
      icon: 'fa-solid fa-clock',
      route: '/time-attendance',
    },
    {
      key: 'NAV.HR',
      icon: 'fa-solid fa-user-tie',
      route: '/hr',
    },
    {
      key: 'NAV.ACCOUNTING',
      icon: 'fa-solid fa-landmark',
      route: '/accounting',
    },
    {
      key: 'NAV.SETTINGS',
      icon: 'fa-solid fa-gears',
      route: '/settings',
    },
  ];
}
