import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AppStore } from '@core';

interface MenuItem {
  title: string;
  icon: string;
  route?: string;
  children?: { title: string; route: string; icon: string }[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, NzMenuModule, NzTooltipModule],
  template: `
    <div class="sidebar-brand">
      <i class="fa-solid fa-receipt brand-icon"></i>
      @if (!appStore.isCollapsed()) {
        <span class="brand-text">Fattura Facile</span>
      }
    </div>

    <ul
      nz-menu
      nzTheme="dark"
      nzMode="inline"
      [nzInlineCollapsed]="appStore.isCollapsed()"
      class="sidebar-menu"
    >
      @for (item of menuItems; track item.title) {
        @if (!item.children) {
          <li nz-menu-item nzMatchRouter>
            <a [routerLink]="item.route">
              <i [class]="item.icon + ' fa-icon-spaced'"></i>
              <span>{{ item.title }}</span>
            </a>
          </li>
        } @else {
          <li nz-submenu [nzTitle]="submenuTitle">
            <ng-template #submenuTitle>
              <i [class]="item.icon + ' fa-icon-spaced'"></i>
              <span>{{ item.title }}</span>
            </ng-template>
            <ul>
              @for (sub of item.children; track sub.route) {
                <li nz-menu-item nzMatchRouter>
                  <a [routerLink]="sub.route">
                    <i [class]="sub.icon + ' fa-icon-spaced'"></i>
                    <span>{{ sub.title }}</span>
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
    }

    .sidebar-brand {
      height: 64px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      white-space: nowrap;
      overflow: hidden;
    }

    .brand-icon {
      font-size: 24px;
      color: #1890ff;
      flex-shrink: 0;
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
    }

    .sidebar-menu::-webkit-scrollbar {
      width: 4px;
    }

    .sidebar-menu::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }
  `,
})
export class SidebarComponent {
  readonly appStore = inject(AppStore);

  readonly menuItems: MenuItem[] = [
    {
      title: 'Dashboard & Panoramica',
      icon: 'fa-solid fa-gauge-high',
      route: '/dashboard',
    },
    {
      title: 'CRM & Anagrafiche',
      icon: 'fa-solid fa-users',
      children: [
        { title: 'Clienti Cross-Border', route: '/crm/clients', icon: 'fa-solid fa-address-book' },
        { title: 'Fornitori & Listini', route: '/crm/suppliers', icon: 'fa-solid fa-truck-field' },
      ],
    },
    {
      title: 'Vendite & Fatturazione',
      icon: 'fa-solid fa-file-invoice-dollar',
      children: [
        { title: 'Preventivi & Ordini', route: '/sales/orders', icon: 'fa-solid fa-cart-shopping' },
        { title: 'Fattura Elettronica SDI', route: '/sales/sdi', icon: 'fa-solid fa-receipt' },
        { title: 'Swiss QR-Bill', route: '/sales/qr-bill', icon: 'fa-solid fa-qrcode' },
      ],
    },
    {
      title: 'Acquisti & AP',
      icon: 'fa-solid fa-cart-flatbed',
      children: [
        { title: 'Ciclo Passivo SDI', route: '/purchases/sdi-inbox', icon: 'fa-solid fa-inbox' },
        { title: 'Scanner QR & pain.001', route: '/purchases/qr-scanner', icon: 'fa-solid fa-file-import' },
        { title: 'Note Spese', route: '/purchases/expenses', icon: 'fa-solid fa-wallet' },
      ],
    },
    {
      title: 'Tesoreria & Banche',
      icon: 'fa-solid fa-building-columns',
      route: '/treasury',
    },
    {
      title: 'Magazzino & Logistica',
      icon: 'fa-solid fa-boxes-stacked',
      children: [
        { title: 'Giacenze & Articoli', route: '/inventory/stock', icon: 'fa-solid fa-warehouse' },
        { title: 'DDT & Trasporti', route: '/inventory/ddt', icon: 'fa-solid fa-truck-ramp-box' },
        { title: 'Dogana IT-CH & CMR', route: '/inventory/customs', icon: 'fa-solid fa-passport' },
      ],
    },
    {
      title: 'Assistenza & Interventi',
      icon: 'fa-solid fa-screwdriver-wrench',
      children: [
        { title: 'Ticket Helpdesk SLA', route: '/field-service/tickets', icon: 'fa-solid fa-ticket' },
        { title: 'Rapportini Intervento', route: '/field-service/reports', icon: 'fa-solid fa-screwdriver-wrench' },
      ],
    },
    {
      title: 'Automotive & Gomme',
      icon: 'fa-solid fa-car',
      children: [
        { title: 'Officina & Schede', route: '/automotive/workshop', icon: 'fa-solid fa-wrench' },
        { title: 'Hotel Pneumatici', route: '/automotive/tire-hotel', icon: 'fa-solid fa-circle-dot' },
      ],
    },
    {
      title: 'Noleggio Flotte',
      icon: 'fa-solid fa-car-side',
      children: [
        { title: 'Planning Flotta', route: '/rent/fleet', icon: 'fa-solid fa-calendar-week' },
        { title: 'Perizia Danni', route: '/rent/appraisal', icon: 'fa-solid fa-car-burst' },
      ],
    },
    {
      title: 'Cantieri & Impianti',
      icon: 'fa-solid fa-person-digging',
      route: '/construction',
    },
    {
      title: 'Studi Professionali',
      icon: 'fa-solid fa-scale-balanced',
      route: '/professionals',
    },
    {
      title: 'Produzione & MRP',
      icon: 'fa-solid fa-industry',
      route: '/manufacturing',
    },
    {
      title: 'Vendita al Banco & POS',
      icon: 'fa-solid fa-cash-register',
      route: '/retail',
    },
    {
      title: 'Presenze & Cartellino',
      icon: 'fa-solid fa-clock',
      route: '/time-attendance',
    },
    {
      title: 'Payroll & HR IT-CH',
      icon: 'fa-solid fa-user-tie',
      route: '/hr',
    },
    {
      title: 'Contabilità & Fiscale',
      icon: 'fa-solid fa-landmark',
      route: '/accounting',
    },
    {
      title: 'Impostazioni & Tenant',
      icon: 'fa-solid fa-gears',
      route: '/settings',
    },
  ];
}
