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
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
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
        { key: 'NAV.INVOICES', route: '/sales/invoices', icon: 'fa-solid fa-file-invoice' },
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
      key: 'NAV.ALERTS',
      icon: 'fa-solid fa-bell',
      route: '/alerts',
    },
    {
      key: 'NAV.SYSTEM',
      icon: 'fa-solid fa-server',
      route: '/system',
    },
    {
      key: 'NAV.SETTINGS',
      icon: 'fa-solid fa-gears',
      route: '/settings',
    },
  ];
}
