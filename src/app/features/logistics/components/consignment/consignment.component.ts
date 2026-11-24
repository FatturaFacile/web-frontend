import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  ConsignmentAgreement,
  ConsignmentLedgerWarehouse,
  InventoryValuation,
  LOGISTICS_PERMISSIONS,
  LogisticsApiService,
  LookupPartner,
  LookupProduct,
  ThirdPartyRegister,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { directionForWarehouseType, toIsoDate } from '../../logistics.rules';
import { warehouseTypeKey } from '../../logistics.ui';
import { ConsignmentDeclarationsComponent } from './consignment-declarations.component';
import { ConsignmentAgreementsComponent } from './consignment-agreements.component';
import { ConsumptionDeclarationWizardComponent } from './consumption-declaration-wizard.component';
import { ValuationSummaryComponent } from './valuation-summary.component';

/**
 * Consignment & third-party register dashboard: goods at customers, goods at subcontractors and vendor consignment
 * held (all from the third-party register), the fiscal valuation split owned vs third party and the agreements.
 */
@Component({
  selector: 'app-consignment',
  imports: [
    CurrencyPipe,
    FormsModule,
    NgTemplateOutlet,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    ConsignmentAgreementsComponent,
    ConsignmentDeclarationsComponent,
    ConsumptionDeclarationWizardComponent,
    ValuationSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consignment.component.html',
  styleUrl: './consignment.component.scss',
})
export class ConsignmentComponent implements OnInit {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(LogisticsApiService);

  protected readonly perm = LOGISTICS_PERMISSIONS;
  protected readonly typeKey = warehouseTypeKey;
  protected readonly loading = signal(false);
  protected readonly register = signal<ThirdPartyRegister | null>(null);
  protected readonly valuation = signal<InventoryValuation | null>(null);
  protected readonly partners = signal<LookupPartner[]>([]);
  protected readonly products = signal<LookupProduct[]>([]);
  protected readonly agreements = signal<ConsignmentAgreement[]>([]);

  protected readonly partnerId = signal<string | null>(null);
  protected readonly period = signal<Date[]>([]);
  protected readonly declareTarget = signal<ConsignmentLedgerWarehouse | null>(null);

  protected readonly partnerOptions = computed(() =>
    this.partners().map((p) => ({
      value: p.id,
      label: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.id,
    })),
  );
  protected readonly counts = computed(() => ({
    customers: this.register()?.goods_at_customers.length ?? 0,
    subcontractors: this.register()?.goods_at_subcontractors.length ?? 0,
    vendor: this.register()?.vendor_consignment_held.length ?? 0,
  }));

  ngOnInit(): void {
    this.reload();
    this.api.partners().subscribe((res) => this.partners.set(res.data));
    this.api.products().subscribe((res) => this.products.set(res.data));
    this.loadAgreements();
  }

  protected reload(): void {
    this.loading.set(true);
    const [from, to] = this.period();
    this.api
      .thirdPartyRegister({
        partner_id: this.partnerId() ?? undefined,
        from: from ? toIsoDate(from) : undefined,
        to: to ? toIsoDate(to) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.register.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.api.fiscalValuation().subscribe((res) => this.valuation.set(res.data));
  }

  protected setPartner(id: string | null): void {
    this.partnerId.set(id);
    this.reload();
  }

  protected setPeriod(range: Date[] | null): void {
    this.period.set(range ?? []);
    this.reload();
  }

  /** Consumption can only be declared on customer / vendor consignment warehouses. */
  protected canDeclare(warehouse: ConsignmentLedgerWarehouse): boolean {
    return (
      this.auth.can(LOGISTICS_PERMISSIONS.consignment) &&
      directionForWarehouseType(warehouse.warehouse_type) !== null
    );
  }

  protected onDeclared(): void {
    this.declareTarget.set(null);
    this.reload();
    this.loadAgreements();
  }

  private loadAgreements(): void {
    this.api.listAgreements({ status: 'active' }).subscribe((res) => this.agreements.set(res.data));
  }
}
