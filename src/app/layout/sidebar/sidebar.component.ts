import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { filter, map } from 'rxjs';
import { AppStore, AuthStore, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';

interface MenuItem {
  key: string;
  icon: string;
  route?: string;
  module?: string;
  children?: { key: string; route: string; icon: string; module?: string }[];
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
  readonly authStore = inject(AuthStore);
  readonly permissions = inject(PermissionsService);
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
    for (const section of this.filteredSections()) {
      for (const item of section.items) {
        if (item.children?.some((child) => path === child.route || path.startsWith(`${child.route}/`))) {
          return item.key;
        }
      }
    }
    return null;
  }

  readonly allMenuSections: readonly MenuSection[] = [
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
          module: 'crm',
          children: [
            { key: 'NAV.CLIENTS', route: '/crm/clients', icon: 'fa-solid fa-address-book', module: 'crm' },
            { key: 'NAV.SUPPLIERS', route: '/crm/suppliers', icon: 'fa-solid fa-truck-field', module: 'crm' },
            { key: 'NAV.CRMX_ACTIVITIES', route: '/crm/engagement/activities', icon: 'fa-solid fa-list-check', module: 'crm' },
            { key: 'NAV.CRMX_ACCOUNTS', route: '/crm/engagement/accounts', icon: 'fa-solid fa-building', module: 'crm' },
            { key: 'NAV.CRMX_SEGMENTS', route: '/crm/engagement/segments', icon: 'fa-solid fa-filter', module: 'crm' },
            { key: 'NAV.CRMX_CAMPAIGNS', route: '/crm/engagement/campaigns', icon: 'fa-solid fa-bullhorn', module: 'crm' },
            { key: 'NAV.CRMX_SCORING', route: '/crm/engagement/scoring', icon: 'fa-solid fa-star-half-stroke', module: 'crm' },
            { key: 'NAV.CRMX_REPORTS', route: '/crm/engagement/reports', icon: 'fa-solid fa-chart-pie', module: 'crm' },
          ],
        },
        {
          key: 'NAV.SALES',
          icon: 'fa-solid fa-file-invoice-dollar',
          module: 'invoicing',
          children: [
            { key: 'NAV.INVOICES', route: '/sales/invoices', icon: 'fa-solid fa-file-invoice', module: 'invoicing' },
            { key: 'NAV.ORDERS', route: '/sales/orders', icon: 'fa-solid fa-cart-shopping', module: 'invoicing' },
            { key: 'NAV.SDI', route: '/sales/sdi', icon: 'fa-solid fa-receipt', module: 'invoicing' },
            { key: 'NAV.QR_BILL', route: '/sales/qr-bill', icon: 'fa-solid fa-qrcode', module: 'invoicing' },
            { key: 'NAV.SC_OVERVIEW', route: '/sales/cycle/overview', icon: 'fa-solid fa-chart-line', module: 'invoicing' },
            { key: 'NAV.SC_QUOTES', route: '/sales/cycle/quotes', icon: 'fa-solid fa-file-signature', module: 'invoicing' },
            { key: 'NAV.SC_ORDERS', route: '/sales/cycle/orders', icon: 'fa-solid fa-clipboard-list', module: 'invoicing' },
            { key: 'NAV.SC_DDT', route: '/sales/cycle/delivery-notes', icon: 'fa-solid fa-truck-ramp-box', module: 'invoicing' },
            { key: 'NAV.SC_RETURNS', route: '/sales/cycle/returns', icon: 'fa-solid fa-rotate-left', module: 'invoicing' },
            { key: 'NAV.SC_PRICING', route: '/sales/cycle/pricing', icon: 'fa-solid fa-tags', module: 'invoicing' },
            { key: 'NAV.SC_CREDIT', route: '/sales/cycle/credit', icon: 'fa-solid fa-scale-balanced', module: 'invoicing' },
            { key: 'NAV.SC_PLANS', route: '/sales/billing/plans', icon: 'fa-solid fa-calendar-check', module: 'invoicing' },
            { key: 'NAV.SC_DEFERRED', route: '/sales/billing/deferred', icon: 'fa-solid fa-layer-group', module: 'invoicing' },
            { key: 'NAV.SC_DEBIT', route: '/sales/billing/debit-notes', icon: 'fa-solid fa-file-circle-plus', module: 'invoicing' },
            { key: 'NAV.SC_REPORTS', route: '/sales/billing/reports', icon: 'fa-solid fa-table-list', module: 'invoicing' },
            { key: 'NAV.SC_APPROVALS', route: '/sales/billing/approvals', icon: 'fa-solid fa-user-check', module: 'invoicing' },
            { key: 'NAV.CAT_MASTER_DATA', route: '/catalog', icon: 'fa-solid fa-boxes-stacked', module: 'invoicing' },
            { key: 'NAV.SUBX_BILLING', route: '/subscriptions/billing', icon: 'fa-solid fa-arrows-rotate', module: 'subscriptions' },
          ],
        },
        {
          key: 'NAV.PURCHASES',
          icon: 'fa-solid fa-cart-flatbed',
          module: 'procurement',
          children: [
            { key: 'NAV.SDI_INBOX', route: '/purchases/sdi-inbox', icon: 'fa-solid fa-inbox', module: 'procurement' },
            {
              key: 'NAV.QR_SCANNER',
              route: '/purchases/qr-scanner',
              icon: 'fa-solid fa-file-import',
              module: 'procurement',
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
          module: 'treasury',
        },
        {
          key: 'NAV.ACCOUNTING',
          icon: 'fa-solid fa-landmark',
          route: '/accounting',
          module: 'ledger',
        },
        {
          key: 'NAV.PEOPLE',
          icon: 'fa-solid fa-people-group',
          children: [
            { key: 'NAV.TIME_ATTENDANCE', route: '/time-attendance', icon: 'fa-solid fa-clock' },
            { key: 'NAV.HR', route: '/hr', icon: 'fa-solid fa-user-tie', module: 'hr' },
            { key: 'NAV.EXPENSES', route: '/purchases/expenses', icon: 'fa-solid fa-wallet', module: 'procurement' },
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
          module: 'inventory',
          children: [
            { key: 'NAV.STOCK', route: '/inventory/stock', icon: 'fa-solid fa-warehouse', module: 'inventory' },
            { key: 'NAV.DDT', route: '/inventory/ddt', icon: 'fa-solid fa-truck-ramp-box', module: 'inventory' },
            { key: 'NAV.CUSTOMS', route: '/inventory/customs', icon: 'fa-solid fa-passport', module: 'customs' },
          ],
        },
        {
          key: 'NAV.PORTAL',
          icon: 'fa-solid fa-users-viewfinder',
          route: '/portal',
        },
        {
          key: 'NAV.INTRASTAT',
          icon: 'fa-solid fa-earth-europe',
          route: '/intrastat',
        },
        {
          key: 'NAV.DOCUMENT_TRUST',
          icon: 'fa-solid fa-shield-halved',
          route: '/document-trust',
        },
        {
          key: 'NAV.ECOMMERCE_INTEGRATIONS',
          icon: 'fa-solid fa-cart-shopping',
          route: '/ecommerce-integrations',
        },
        {
          key: 'NAV.TESSERA_SANITARIA',
          icon: 'fa-solid fa-file-medical',
          route: '/tessera-sanitaria',
        },
        {
          key: 'NAV.VISITORS',
          icon: 'fa-solid fa-id-badge',
          route: '/visitors',
        },
        {
          key: 'NAV.COMMUNICATION',
          icon: 'fa-solid fa-tower-broadcast',
          route: '/communication',
        },
        {
          key: 'NAV.APPOINTMENTS',
          icon: 'fa-solid fa-calendar-check',
          route: '/appointments',
          module: 'service',
        },
        {
          key: 'NAV.FIELD_SERVICE',
          icon: 'fa-solid fa-screwdriver-wrench',
          module: 'service',
          children: [
            {
              key: 'NAV.TICKETS',
              route: '/field-service/tickets',
              icon: 'fa-solid fa-ticket',
              module: 'service',
            },
            {
              key: 'NAV.REPORTS',
              route: '/field-service/reports',
              icon: 'fa-solid fa-screwdriver-wrench',
              module: 'service',
            },
          ],
        },
        {
          key: 'NAV.WORKFLOWS',
          icon: 'fa-solid fa-diagram-project',
          route: '/workflows',
          module: 'workflow',
        },
        {
          key: 'NAV.DMS',
          icon: 'fa-solid fa-folder-tree',
          route: '/dms',
          module: 'documents',
        },
        {
          key: 'NAV.CONTRACT_REGISTER',
          icon: 'fa-solid fa-file-signature',
          route: '/contract-register',
          module: 'contracts',
        },
        {
          key: 'NAV.ASSOCIATIONS',
          icon: 'fa-solid fa-hands-holding-child',
          route: '/associations',
          module: 'associations',
        },
        {
          key: 'NAV.CHILDCARE',
          icon: 'fa-solid fa-shapes',
          route: '/childcare',
          module: 'childcare',
        },
      ],
    },
    {
      key: 'NAV.SECTION_INDUSTRY',
      items: [
        {
          key: 'NAV.AUTOMOTIVE',
          icon: 'fa-solid fa-car',
          module: 'automotive',
          children: [
            { key: 'NAV.WORKSHOP', route: '/automotive/workshop', icon: 'fa-solid fa-wrench', module: 'workshop' },
            {
              key: 'NAV.TIRE_HOTEL',
              route: '/automotive/tire-hotel',
              icon: 'fa-solid fa-circle-dot',
              module: 'automotive',
            },
          ],
        },
        {
          key: 'NAV.RENT',
          icon: 'fa-solid fa-car-side',
          module: 'contracts',
          children: [
            { key: 'NAV.FLEET', route: '/rent/fleet', icon: 'fa-solid fa-calendar-week', module: 'contracts' },
            { key: 'NAV.APPRAISAL', route: '/rent/appraisal', icon: 'fa-solid fa-car-burst', module: 'contracts' },
          ],
        },
        {
          key: 'NAV.CONSTRUCTION',
          icon: 'fa-solid fa-person-digging',
          route: '/construction',
          module: 'construction',
        },
        {
          key: 'NAV.PROFESSIONALS',
          icon: 'fa-solid fa-scale-balanced',
          route: '/professionals',
          module: 'professionals',
        },
        {
          key: 'NAV.MANUFACTURING',
          icon: 'fa-solid fa-industry',
          route: '/manufacturing',
          module: 'manufacturing',
        },
        {
          key: 'NAV.HOSPITALITY',
          icon: 'fa-solid fa-utensils',
          route: '/hospitality',
          module: 'hospitality',
        },
        {
          key: 'NAV.RETAIL',
          icon: 'fa-solid fa-cash-register',
          route: '/retail',
          module: 'fiscal_retail',
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
            { key: 'NAV.CRM', route: '/modules/crm', icon: 'fa-solid fa-address-book', module: 'crm' },
            { key: 'NAV.ACCOUNTING', route: '/modules/accounting', icon: 'fa-solid fa-landmark', module: 'ledger' },
            { key: 'NAV.MOD_BANK_RECONCILIATION', route: '/modules/bank-reconciliation', icon: 'fa-solid fa-building-columns', module: 'treasury' },
            { key: 'NAV.MOD_INVOICING', route: '/modules/invoicing', icon: 'fa-solid fa-file-invoice-dollar', module: 'invoicing' },
            { key: 'NAV.MOD_PRODUCTS', route: '/modules/products', icon: 'fa-solid fa-tags', module: 'inventory' },
            { key: 'NAV.MOD_AGENDA', route: '/modules/agenda', icon: 'fa-solid fa-calendar-days' },
            { key: 'NAV.HR', route: '/modules/hr', icon: 'fa-solid fa-user-tie', module: 'hr' },
            { key: 'NAV.MOD_PRODUCTION', route: '/modules/production', icon: 'fa-solid fa-industry', module: 'manufacturing' },
            { key: 'NAV.MOD_MARKETING', route: '/modules/marketing', icon: 'fa-solid fa-bullhorn', module: 'crm' },
            { key: 'NAV.MOD_FORMS', route: '/modules/forms', icon: 'fa-solid fa-clipboard-list' },
          ],
        },
        {
          key: 'NAV.SECTORS',
          icon: 'fa-solid fa-shop',
          children: [
            { key: 'NAV.SECTOR_SME', route: '/sectors/sme', icon: 'fa-solid fa-store' },
            { key: 'NAV.SECTOR_MECHANIC', route: '/sectors/mechanic', icon: 'fa-solid fa-wrench', module: 'automotive' },
            { key: 'NAV.SECTOR_CRAFT', route: '/sectors/craft-lab', icon: 'fa-solid fa-hammer' },
          ],
        },
        {
          key: 'NAV.ADVANCED',
          icon: 'fa-solid fa-star',
          children: [
            { key: 'NAV.ADV_AI', route: '/advanced/ai-assistant', icon: 'fa-solid fa-robot', module: 'assistant' },
            { key: 'NAV.ADV_SECURITY', route: '/advanced/security', icon: 'fa-solid fa-shield-halved', module: 'system' },
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
            { key: 'NAV.COMPANY_SETTINGS', route: '/settings/tenant', icon: 'fa-solid fa-building' },
            { key: 'NAV.SYSTEM', route: '/system', icon: 'fa-solid fa-server', module: 'system' },
            { key: 'NAV.WORKSPACE', route: '/workspace', icon: 'fa-solid fa-cloud', module: 'system' },
          ],
        },
      ],
    },
  ];

  /** Menu sections filtered reactively based on the active tenant role and module permissions */
  readonly filteredSections = computed<MenuSection[]>(() => {
    // Read the active role signal to trigger reactivity on tenant/role change
    this.authStore.activeRole();

    return this.allMenuSections
      .map((section) => {
        const filteredItems = section.items
          .map((item) => {
            if (item.module && !this.permissions.canRead(item.module)) {
              return null;
            }

            if (item.children) {
              const filteredChildren = item.children.filter((child) => {
                const childModule = child.module ?? item.module;
                return !childModule || this.permissions.canRead(childModule);
              });

              if (filteredChildren.length === 0 && !item.route) {
                return null;
              }

              return { ...item, children: filteredChildren };
            }

            return item;
          })
          .filter((item): item is MenuItem => item !== null);

        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  });
}
