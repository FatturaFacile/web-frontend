import { Component, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { filter, map } from 'rxjs';
import { AppStore } from '@core';
import { TranslatePipe } from '@shared';

interface MenuItem {
  key: string;
  icon: string;
  route?: string;
  children?: { key: string; route: string; icon: string }[];
}

interface MenuSection {
  /** Section heading; the first section (Dashboard) has none */
  key?: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, NzMenuModule, NzTooltipModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly appStore = inject(AppStore);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Accordion: only one group is open, reset to the group of the current page on every navigation */
  protected readonly openGroup = linkedSignal<string | null>(() => this.groupOf(this.currentUrl()));

  protected onGroupOpenChange(key: string, open: boolean): void {
    // In the collapsed sidebar groups open as hover popups, which must not change the accordion state
    if (this.appStore.isCollapsed()) {
      return;
    }
    this.openGroup.update((current) => (open ? key : current === key ? null : current));
  }

  private groupOf(url: string): string | null {
    const path = url.split(/[?#]/)[0];
    for (const section of this.menuSections) {
      for (const item of section.items) {
        if (item.children?.some((child) => path === child.route || path.startsWith(`${child.route}/`))) {
          return item.key;
        }
      }
    }
    return null;
  }

  readonly menuSections: readonly MenuSection[] = [
    {
      items: [
        {
          key: 'NAV.DASHBOARD',
          icon: 'fa-solid fa-gauge-high',
          route: '/dashboard',
        },
      ],
    },
    {
      key: 'NAV.SECTION_COMMERCIAL',
      items: [
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
          ],
        },
      ],
    },
    {
      key: 'NAV.SECTION_ADMINISTRATION',
      items: [
        {
          key: 'NAV.TREASURY',
          icon: 'fa-solid fa-building-columns',
          route: '/treasury',
        },
        {
          key: 'NAV.ACCOUNTING',
          icon: 'fa-solid fa-landmark',
          route: '/accounting',
        },
        {
          key: 'NAV.PEOPLE',
          icon: 'fa-solid fa-people-group',
          children: [
            { key: 'NAV.TIME_ATTENDANCE', route: '/time-attendance', icon: 'fa-solid fa-clock' },
            { key: 'NAV.HR', route: '/hr', icon: 'fa-solid fa-user-tie' },
            { key: 'NAV.EXPENSES', route: '/purchases/expenses', icon: 'fa-solid fa-wallet' },
          ],
        },
      ],
    },
    {
      key: 'NAV.SECTION_OPERATIONS',
      items: [
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
      ],
    },
    {
      key: 'NAV.SECTION_INDUSTRY',
      items: [
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
      ],
    },
    {
      key: 'NAV.SECTION_EXTENSIONS',
      items: [
        {
          key: 'NAV.TOOLS',
          icon: 'fa-solid fa-toolbox',
          children: [
            { key: 'NAV.TOOL_VAT', route: '/tools/vat-calculator', icon: 'fa-solid fa-percent' },
            { key: 'NAV.TOOL_MARGIN', route: '/tools/margin-calculator', icon: 'fa-solid fa-chart-line' },
            { key: 'NAV.TOOL_LETTER', route: '/tools/commercial-letter', icon: 'fa-solid fa-envelope-open-text' },
            { key: 'NAV.TOOL_VCARD', route: '/tools/vcard-qr', icon: 'fa-solid fa-address-card' },
            { key: 'NAV.TOOL_QR', route: '/tools/qr-generator', icon: 'fa-solid fa-qrcode' },
            { key: 'NAV.TOOL_HOURS', route: '/tools/working-hours', icon: 'fa-solid fa-hourglass-half' },
            { key: 'NAV.TOOL_CAMT', route: '/tools/camt-statement', icon: 'fa-solid fa-file-code' },
            { key: 'NAV.TOOL_QR_INVOICE', route: '/tools/qr-invoice', icon: 'fa-solid fa-file-invoice' },
            { key: 'NAV.TOOL_PDF', route: '/tools/pdf-editor', icon: 'fa-solid fa-file-pdf' },
          ],
        },
        {
          key: 'NAV.MODULES',
          icon: 'fa-solid fa-cubes',
          children: [
            { key: 'NAV.CRM', route: '/modules/crm', icon: 'fa-solid fa-address-book' },
            { key: 'NAV.ACCOUNTING', route: '/modules/accounting', icon: 'fa-solid fa-landmark' },
            { key: 'NAV.MOD_BANK_RECONCILIATION', route: '/modules/bank-reconciliation', icon: 'fa-solid fa-building-columns' },
            { key: 'NAV.MOD_INVOICING', route: '/modules/invoicing', icon: 'fa-solid fa-file-invoice-dollar' },
            { key: 'NAV.MOD_PRODUCTS', route: '/modules/products', icon: 'fa-solid fa-tags' },
            { key: 'NAV.MOD_AGENDA', route: '/modules/agenda', icon: 'fa-solid fa-calendar-days' },
            { key: 'NAV.HR', route: '/modules/hr', icon: 'fa-solid fa-user-tie' },
            { key: 'NAV.MOD_PRODUCTION', route: '/modules/production', icon: 'fa-solid fa-industry' },
            { key: 'NAV.MOD_MARKETING', route: '/modules/marketing', icon: 'fa-solid fa-bullhorn' },
            { key: 'NAV.MOD_FORMS', route: '/modules/forms', icon: 'fa-solid fa-clipboard-list' },
          ],
        },
        {
          key: 'NAV.SECTORS',
          icon: 'fa-solid fa-shop',
          children: [
            { key: 'NAV.SECTOR_SME', route: '/sectors/sme', icon: 'fa-solid fa-store' },
            { key: 'NAV.SECTOR_MECHANIC', route: '/sectors/mechanic', icon: 'fa-solid fa-wrench' },
            { key: 'NAV.SECTOR_CRAFT', route: '/sectors/craft-lab', icon: 'fa-solid fa-hammer' },
          ],
        },
        {
          key: 'NAV.ADVANCED',
          icon: 'fa-solid fa-star',
          children: [
            { key: 'NAV.ADV_AI', route: '/advanced/ai-assistant', icon: 'fa-solid fa-robot' },
            { key: 'NAV.ADV_SECURITY', route: '/advanced/security', icon: 'fa-solid fa-shield-halved' },
            { key: 'NAV.ADV_EVENTS', route: '/advanced/events-polls', icon: 'fa-solid fa-square-poll-vertical' },
            { key: 'NAV.ADV_WEB_APP', route: '/advanced/web-app', icon: 'fa-solid fa-globe' },
          ],
        },
        {
          key: 'NAV.DOCS',
          icon: 'fa-solid fa-book',
          children: [
            { key: 'NAV.DOC_INTRO', route: '/docs/intro', icon: 'fa-solid fa-circle-info' },
            { key: 'NAV.DOC_LABELS', route: '/docs/labels', icon: 'fa-solid fa-tag' },
            { key: 'NAV.DOC_USE_CASES', route: '/docs/use-cases', icon: 'fa-solid fa-lightbulb' },
          ],
        },
      ],
    },
    {
      key: 'NAV.SECTION_SYSTEM',
      items: [
        {
          key: 'NAV.SETTINGS',
          icon: 'fa-solid fa-gears',
          children: [
            { key: 'NAV.COMPANY_SETTINGS', route: '/settings', icon: 'fa-solid fa-building' },
            { key: 'NAV.SYSTEM', route: '/system', icon: 'fa-solid fa-server' },
          ],
        },
      ],
    },
  ];
}
