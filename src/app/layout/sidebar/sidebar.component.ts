import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { filter, map } from 'rxjs';
// Deep imports keep the `@core` and `@shared` barrels out of the initial bundle.
import { AuthStore } from '@core/auth/auth.store';
import { PermissionsService } from '@core/auth/permissions.service';
import { TranslateService } from '@core/i18n/i18n.service';
import { AppStore } from '@core/state/app.store';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { isMenuRouteTested, normalizeMenuSearch } from './menu-availability';

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
  imports: [RouterLink, NzIconModule, NzInputModule, NzMenuModule, NzTooltipModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  readonly permissions = inject(PermissionsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslateService);

  /** Text typed in the quick search box of the menu */
  protected readonly searchTerm = signal('');
  protected readonly isSearching = computed(() => normalizeMenuSearch(this.searchTerm()) !== '');

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Accordion: only one group is open, reset to the group of the current page on every navigation */
  protected readonly openGroup = linkedSignal<string | null>(() => this.groupOf(this.currentUrl()));

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
  }

  /** An entry is enabled once its route is in TESTED_MENU_ROUTES; the others are greyed out */
  protected isEnabled(route: string | undefined): boolean {
    return isMenuRouteTested(route);
  }

  /** A group is enabled as soon as one of its entries is */
  protected isGroupEnabled(item: MenuItem): boolean {
    return item.children?.some((child) => isMenuRouteTested(child.route)) ?? isMenuRouteTested(item.route);
  }

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
            { key: 'NAV.PURCHASE_ORDERS', route: '/purchases/orders', icon: 'fa-solid fa-cart-shopping', module: 'procurement' },
            { key: 'NAV.PURCHASE_INVOICES', route: '/purchases/invoices', icon: 'fa-solid fa-file-invoice', module: 'procurement' },
            { key: 'NAV.PROC_SUPPLIERS', route: '/procurement/suppliers', icon: 'fa-solid fa-truck-field', module: 'procurement' },
            { key: 'NAV.PROC_SOURCING', route: '/procurement/sourcing', icon: 'fa-solid fa-handshake', module: 'procurement' },
            { key: 'NAV.PROC_ORDERS', route: '/procurement/orders', icon: 'fa-solid fa-boxes-packing', module: 'procurement' },
            { key: 'NAV.PROC_ADMIN', route: '/procurement/admin', icon: 'fa-solid fa-sliders', module: 'procurement' },
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
          key: 'NAV.TREASURY_OPERATIONS',
          icon: 'fa-solid fa-money-bill-transfer',
          route: '/treasury/operations',
          module: 'treasury',
        },
        {
          key: 'NAV.ASSET_OPERATIONS',
          icon: 'fa-solid fa-screwdriver-wrench',
          route: '/assets/operations',
          module: 'assets',
        },
        {
          key: 'NAV.EXPORTS',
          icon: 'fa-solid fa-file-export',
          route: '/exports',
          module: 'exports',
        },
        {
          key: 'NAV.ACCOUNTING',
          icon: 'fa-solid fa-landmark',
          route: '/accounting',
          module: 'ledger',
        },
        {
          key: 'NAV.GENERAL_LEDGER',
          icon: 'fa-solid fa-book',
          route: '/general-ledger',
          module: 'ledger',
        },
        {
          key: 'NAV.PEOPLE',
          icon: 'fa-solid fa-people-group',
          children: [
            { key: 'NAV.HR', route: '/hr', icon: 'fa-solid fa-user-tie', module: 'hr' },
            { key: 'NAV.HR_ORGANIZATION', route: '/hr/organization', icon: 'fa-solid fa-sitemap', module: 'hr' },
            { key: 'NAV.HR_LEAVE', route: '/hr/leave', icon: 'fa-solid fa-umbrella-beach', module: 'hr' },
            { key: 'NAV.HR_TIME', route: '/hr/time', icon: 'fa-solid fa-stopwatch', module: 'hr' },
            { key: 'NAV.HR_PAYROLL', route: '/hr/payroll', icon: 'fa-solid fa-money-check-dollar', module: 'payroll' },
            { key: 'NAV.HR_PAYROLL_COMPLIANCE', route: '/hr/payroll-compliance', icon: 'fa-solid fa-scale-balanced', module: 'payroll' },
            { key: 'NAV.HR_SHORT_TIME', route: '/hr/short-time', icon: 'fa-solid fa-helmet-safety', module: 'payroll' },
            { key: 'NAV.HR_TALENT', route: '/hr/talent', icon: 'fa-solid fa-graduation-cap', module: 'hr' },
            { key: 'NAV.HR_RECRUITING', route: '/hr/recruiting', icon: 'fa-solid fa-user-plus', module: 'hr' },
            { key: 'NAV.HR_SHIFTS', route: '/hr/shifts', icon: 'fa-solid fa-calendar-days', module: 'hr' },
            { key: 'NAV.HR_PAYROLL_DATA', route: '/hr/payroll-data', icon: 'fa-solid fa-address-card', module: 'payroll' },
            { key: 'NAV.HR_CCNL', route: '/hr/collective-agreements', icon: 'fa-solid fa-file-contract', module: 'payroll' },
            { key: 'NAV.HR_SELF_SERVICE', route: '/hr/self-service', icon: 'fa-solid fa-id-card' },
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
            { key: 'NAV.CUSTOMS_OPERATIONS', route: '/customs/operations', icon: 'fa-solid fa-boxes-packing', module: 'customs' },
            { key: 'NAV.CUSTOMS_ASSESSMENTS', route: '/customs/assessments', icon: 'fa-solid fa-file-invoice-dollar', module: 'customs' },
            { key: 'NAV.CUSTOMS_SETUP', route: '/customs/setup', icon: 'fa-solid fa-sliders', module: 'customs' },
            { key: 'NAV.WMS_WAREHOUSE', route: '/inventory/warehouse', icon: 'fa-solid fa-map-location-dot', module: 'inventory' },
            { key: 'NAV.WMS_OUTBOUND', route: '/inventory/outbound', icon: 'fa-solid fa-dolly', module: 'inventory' },
            { key: 'NAV.WMS_TRANSFERS', route: '/inventory/transfers', icon: 'fa-solid fa-right-left', module: 'inventory' },
            { key: 'NAV.WMS_COUNTING', route: '/inventory/counting', icon: 'fa-solid fa-clipboard-check', module: 'inventory' },
            { key: 'NAV.WMS_REPLENISHMENT', route: '/inventory/replenishment', icon: 'fa-solid fa-arrows-rotate', module: 'inventory' },
            { key: 'NAV.WMS_LOTS', route: '/inventory/lots', icon: 'fa-solid fa-barcode', module: 'inventory' },
            { key: 'NAV.WMS_ITEMS', route: '/inventory/items', icon: 'fa-solid fa-box-open', module: 'inventory' },
            { key: 'NAV.WMS_REPORTS', route: '/inventory/reports', icon: 'fa-solid fa-chart-column', module: 'inventory' },
            { key: 'NAV.WMS_TERMINAL', route: '/inventory/terminal', icon: 'fa-solid fa-mobile-screen', module: 'inventory' },
            { key: 'NAV.WMS_SERVICES', route: '/inventory/services', icon: 'fa-solid fa-screwdriver-wrench', module: 'inventory' },
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
            {
              key: 'NAV.FS_WORK_ORDERS',
              route: '/field-service/work-orders',
              icon: 'fa-solid fa-clipboard-check',
              module: 'service',
            },
          ],
        },
        {
          key: 'NAV.HELPDESK',
          icon: 'fa-solid fa-headset',
          module: 'service',
          children: [
            { key: 'NAV.HD_REPORTS', route: '/helpdesk/reports', icon: 'fa-solid fa-chart-pie', module: 'service' },
            { key: 'NAV.HD_TOOLS', route: '/helpdesk/tools', icon: 'fa-solid fa-comment-dots', module: 'service' },
            { key: 'NAV.HD_AUTOMATION', route: '/helpdesk/automation', icon: 'fa-solid fa-robot', module: 'service' },
            { key: 'NAV.HD_KB', route: '/helpdesk/knowledge-base', icon: 'fa-solid fa-book-open', module: 'service' },
            { key: 'NAV.HD_ITSM', route: '/helpdesk/itsm', icon: 'fa-solid fa-triangle-exclamation', module: 'service' },
            {
              key: 'NAV.HD_SERVICE_DELIVERY',
              route: '/helpdesk/service-delivery',
              icon: 'fa-solid fa-file-contract',
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
          module: 'contracts',
          children: [
            { key: 'NAV.CONTRACT_REGISTER', route: '/contract-register', icon: 'fa-solid fa-file-signature', module: 'contracts' },
            { key: 'NAV.CONTRACT_DOCUMENTS', route: '/contract-register/documents', icon: 'fa-solid fa-paperclip', module: 'contracts' },
          ],
        },
        {
          key: 'NAV.ASSOCIATIONS',
          icon: 'fa-solid fa-hands-holding-child',
          module: 'associations',
          children: [
            { key: 'NAV.ASSOC_OVERVIEW', route: '/associations', icon: 'fa-solid fa-hands-holding-child', module: 'associations' },
            { key: 'NAV.ASSOC_MEMBERSHIPS', route: '/associations/memberships', icon: 'fa-solid fa-id-card', module: 'associations' },
            { key: 'NAV.ASSOC_COURSES', route: '/associations/courses', icon: 'fa-solid fa-calendar-days', module: 'associations' },
            { key: 'NAV.ASSOC_ENROLMENT', route: '/associations/enrolment', icon: 'fa-solid fa-file-pen', module: 'associations' },
            { key: 'NAV.ASSOC_DEADLINES', route: '/associations/compliance', icon: 'fa-solid fa-notes-medical', module: 'associations' },
            { key: 'NAV.ASSOC_VOLUNTEERS', route: '/associations/volunteers', icon: 'fa-solid fa-people-carry-box', module: 'associations' },
            { key: 'NAV.ASSOC_ACCESS', route: '/associations/access', icon: 'fa-solid fa-door-open', module: 'associations' },
            { key: 'NAV.ASSOC_FEES', route: '/associations/fees', icon: 'fa-solid fa-receipt', module: 'associations' },
            { key: 'NAV.ASSOC_SPORT', route: '/associations/sport', icon: 'fa-solid fa-medal', module: 'associations' },
            { key: 'NAV.ASSOC_FUNDRAISING', route: '/associations/fundraising', icon: 'fa-solid fa-hand-holding-heart', module: 'associations' },
            { key: 'NAV.ASSOC_SETTINGS', route: '/associations/settings', icon: 'fa-solid fa-sliders', module: 'associations' },
          ],
        },
        {
          key: 'NAV.ASSOCIATIONS_GOVERNANCE',
          icon: 'fa-solid fa-scale-balanced',
          module: 'associations',
          children: [
            { key: 'NAV.ASSOC_MEETINGS', route: '/associations/governance/meetings', icon: 'fa-solid fa-people-roof', module: 'associations' },
            { key: 'NAV.ASSOC_PRIVACY', route: '/associations/governance/privacy', icon: 'fa-solid fa-user-shield', module: 'associations' },
            { key: 'NAV.ASSOC_STATEMENTS', route: '/associations/governance/statements', icon: 'fa-solid fa-file-invoice', module: 'associations' },
            { key: 'NAV.ASSOC_COMPLIANCE', route: '/associations/governance/compliance', icon: 'fa-solid fa-book', module: 'associations' },
            { key: 'NAV.ASSOC_NETWORK', route: '/associations/governance/network', icon: 'fa-solid fa-sitemap', module: 'associations' },
            { key: 'NAV.ASSOC_CATALOGS', route: '/associations/governance/catalogs', icon: 'fa-solid fa-sliders', module: 'associations' },
            { key: 'NAV.ASSOC_WORK_CATALOGS', route: '/associations/governance/work-catalogs', icon: 'fa-solid fa-hand-holding-heart', module: 'associations' },
            { key: 'NAV.ASSOC_FUNDRAISING_CATALOGS', route: '/associations/governance/fundraising-catalogs', icon: 'fa-solid fa-hand-holding-dollar', module: 'associations' },
          ],
        },
        {
          key: 'NAV.CHILDCARE',
          icon: 'fa-solid fa-shapes',
          module: 'childcare',
          children: [
            { key: 'NAV.CHILDCARE_OVERVIEW', route: '/childcare', icon: 'fa-solid fa-shapes', module: 'childcare' },
            { key: 'NAV.CHILDCARE_CARE', route: '/childcare/care', icon: 'fa-solid fa-utensils', module: 'childcare' },
            { key: 'NAV.CHILDCARE_FAMILY', route: '/portal/family', icon: 'fa-solid fa-people-roof', module: 'childcare' },
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
          module: 'automotive',
          children: [
            { key: 'NAV.WORKSHOP', route: '/automotive/workshop', icon: 'fa-solid fa-wrench', module: 'workshop' },
            { key: 'NAV.INSPECTIONS', route: '/automotive/inspections', icon: 'fa-solid fa-clipboard-check', module: 'automotive' },
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
          module: 'construction',
          children: [
            { key: 'NAV.CONSTRUCTION_OVERVIEW', route: '/construction', icon: 'fa-solid fa-person-digging', module: 'construction' },
            { key: 'NAV.CONSTRUCTION_BACK_OFFICE', route: '/construction/back-office', icon: 'fa-solid fa-helmet-safety', module: 'construction' },
          ],
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
          module: 'manufacturing',
          children: [
            { key: 'NAV.MANUFACTURING_OVERVIEW', route: '/manufacturing', icon: 'fa-solid fa-gauge', module: 'manufacturing' },
            { key: 'NAV.MFG_ENGINEERING', route: '/manufacturing/engineering', icon: 'fa-solid fa-diagram-project', module: 'manufacturing' },
            { key: 'NAV.MFG_PRODUCTION', route: '/manufacturing/production', icon: 'fa-solid fa-gears', module: 'manufacturing' },
            { key: 'NAV.MFG_QUALITY', route: '/manufacturing/quality', icon: 'fa-solid fa-clipboard-check', module: 'manufacturing' },
            { key: 'NAV.MFG_PLANNING', route: '/manufacturing/planning', icon: 'fa-solid fa-calendar-days', module: 'manufacturing' },
          ],
        },
        {
          key: 'NAV.HOSPITALITY',
          icon: 'fa-solid fa-utensils',
          module: 'hospitality',
          children: [
            { key: 'NAV.HOSPITALITY_OVERVIEW', route: '/hospitality', icon: 'fa-solid fa-utensils', module: 'hospitality' },
            { key: 'NAV.HOSPITALITY_FLOOR', route: '/hospitality/floor', icon: 'fa-solid fa-chair', module: 'hospitality' },
          ],
        },
        {
          key: 'NAV.RETAIL',
          icon: 'fa-solid fa-cash-register',
          module: 'fiscal_retail',
          children: [
            { key: 'NAV.RETAIL_OVERVIEW', route: '/retail', icon: 'fa-solid fa-cash-register', module: 'fiscal_retail' },
            { key: 'NAV.RETAIL_POS_ADMIN', route: '/retail/pos-admin', icon: 'fa-solid fa-receipt', module: 'fiscal_retail' },
          ],
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
            // The `/modules/*` entries of CRM, accounting, bank reconciliation, invoicing, HR and production only
            // redirected to pages that already have their own menu entry: they are not repeated here.
            { key: 'NAV.MOD_PRODUCTS', route: '/modules/products', icon: 'fa-solid fa-tags', module: 'inventory' },
            { key: 'NAV.MOD_AGENDA', route: '/modules/agenda', icon: 'fa-solid fa-calendar-days' },
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
            { key: 'NAV.SDI_CHANNEL', route: '/settings/sdi-channel', icon: 'fa-solid fa-satellite-dish', module: 'system' },
            {
              key: 'NAV.DOCUMENT_TEMPLATES',
              route: '/settings/document-templates',
              icon: 'fa-solid fa-palette',
              module: 'integrations',
            },
            { key: 'NAV.LOOKUP_TRANSLATIONS', route: '/settings/lookups', icon: 'fa-solid fa-language', module: 'system' },
            { key: 'NAV.ADMIN_ACCESS_REQUESTS', route: '/settings/admin/access-requests', icon: 'fa-solid fa-user-check', module: 'system' },
            { key: 'NAV.SYSTEM', route: '/system', icon: 'fa-solid fa-server', module: 'system' },
            { key: 'NAV.WORKSPACE', route: '/workspace', icon: 'fa-solid fa-cloud', module: 'system' },
          ],
        },
      ],
    },
  ];

  /** Menu sections filtered reactively based on the active tenant role and module permissions */
  private readonly permittedSections = computed<MenuSection[]>(() => {
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

  /**
   * The permitted sections, narrowed by the quick search: an entry stays when its own label matches, a group whose
   * own label matches keeps all its entries, otherwise only the entries that match.
   */
  readonly filteredSections = computed<MenuSection[]>(() => {
    const sections = this.permittedSections();
    const term = normalizeMenuSearch(this.searchTerm());
    if (term === '') {
      return sections;
    }

    const matches = (key: string): boolean => normalizeMenuSearch(this.i18n.translate(key)).includes(term);

    return sections
      .map((section) => ({
        ...section,
        items: section.items
          .map((item) => {
            if (!item.children) {
              return matches(item.key) ? item : null;
            }
            if (matches(item.key)) {
              return item;
            }
            const children = item.children.filter((child) => matches(child.key));
            return children.length > 0 ? { ...item, children } : null;
          })
          .filter((item): item is MenuItem => item !== null),
      }))
      .filter((section) => section.items.length > 0);
  });
}
