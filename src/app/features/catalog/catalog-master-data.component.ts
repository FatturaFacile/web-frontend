import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  CatalogApiService,
  I18nService,
  PaymentTerm,
  PaymentTermSchedule,
  PermissionsService,
  ProductBrand,
  ProductCategory,
  SdiTermsCode,
  UnitOfMeasure,
} from '@core';
import { PageHeaderComponent, TranslatePipe, ModalActionsDirective, IconActionDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

const DECIMAL = /^\d+(\.\d{1,2})?$/;

interface TermDraft {
  code: string;
  name: string;
  days: number | null;
  end_of_month: boolean;
  discount_percent: string;
  discount_days: number | null;
  sdi_terms_code: SdiTermsCode | null;
}

const emptyTerm = (): TermDraft => ({
  code: '',
  name: '',
  days: 30,
  end_of_month: false,
  discount_percent: '',
  discount_days: null,
  sdi_terms_code: 'TP02',
});

/** Catalog master data: payment terms (with schedule preview), brands, categories and units of measure. */
@Component({
  selector: 'app-catalog-master-data',
  styleUrl: './catalog-master-data.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './catalog-master-data.component.html',
})
export class CatalogMasterDataComponent {
  private readonly api = inject(CatalogApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));

  protected readonly terms = signal<PaymentTerm[]>([]);
  protected readonly brands = signal<ProductBrand[]>([]);
  protected readonly categories = signal<ProductCategory[]>([]);
  protected readonly units = signal<UnitOfMeasure[]>([]);

  // Payment terms
  protected readonly termOpen = signal(false);
  protected readonly editingTerm = signal<PaymentTerm | null>(null);
  protected termDraft: TermDraft = emptyTerm();
  protected readonly scheduleFor = signal<PaymentTerm | null>(null);
  protected readonly schedule = signal<PaymentTermSchedule | null>(null);
  protected scheduleAmount = '1000.00';

  // Brands, categories, units share a small name/code modal
  protected readonly simpleOpen = signal<'brand' | 'category' | 'unit' | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected simpleName = '';
  protected simpleCode = '';
  protected simpleParent: string | null = null;

  constructor() {
    this.loadAll();
  }

  protected loadAll(): void {
    this.api.getPaymentTerms().subscribe({ next: (r) => this.terms.set(r.data ?? []) });
    this.api.getBrands().subscribe({ next: (r) => this.brands.set(r.data ?? []) });
    this.api.getCategories().subscribe({ next: (r) => this.categories.set(r.data ?? []) });
    this.api.getUnits().subscribe({ next: (r) => this.units.set(r.data ?? []) });
  }

  protected categoryName(id: string | null | undefined): string {
    return this.categories().find((c) => c.id === id)?.name ?? '-';
  }

  // Payment terms
  protected openTerm(term: PaymentTerm | null): void {
    this.editingTerm.set(term);
    this.termDraft = term
      ? {
          code: term.code,
          name: term.name,
          days: term.days ?? null,
          end_of_month: !!term.end_of_month,
          discount_percent: term.discount_percent ?? '',
          discount_days: term.discount_days ?? null,
          sdi_terms_code: term.sdi_terms_code ?? null,
        }
      : emptyTerm();
    this.termOpen.set(true);
  }

  protected termValid(): boolean {
    const d = this.termDraft;
    const percent = d.discount_percent.trim();
    const hasDiscountDays = d.discount_days !== null && d.discount_days !== undefined;
    const percentValid = !percent || (DECIMAL.test(percent) && Number(percent) > 0 && Number(percent) <= 100);
    const daysValid = !hasDiscountDays || d.discount_days! >= 0;
    const daysInRange = d.days === null || d.days === undefined || (d.days >= 0 && d.days <= 365);
    // The discount percentage and the discount days go together.
    const discountPaired = !!percent === hasDiscountDays;
    return (
      d.code.trim().length > 0 &&
      d.code.trim().length <= 20 &&
      d.name.trim().length > 0 &&
      d.name.trim().length <= 100 &&
      percentValid &&
      daysValid &&
      daysInRange &&
      discountPaired
    );
  }

  protected saveTerm(): void {
    const d = this.termDraft;
    const payload = {
      code: d.code.trim(),
      name: d.name.trim(),
      days: d.days,
      end_of_month: d.end_of_month,
      discount_percent: d.discount_percent || null,
      discount_days: d.discount_days,
      sdi_terms_code: d.sdi_terms_code,
    };
    const current = this.editingTerm();
    const request = current ? this.api.updatePaymentTerm(current.id, payload) : this.api.createPaymentTerm(payload);
    request.subscribe({
      next: () => {
        this.termOpen.set(false);
        this.message.success(this.i18n.translate('CAT.SAVED'));
        this.loadAll();
      },
    });
  }

  protected removeTerm(term: PaymentTerm): void {
    this.api.deletePaymentTerm(term.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CAT.DELETED'));
        this.loadAll();
      },
    });
  }

  protected openSchedule(term: PaymentTerm): void {
    this.scheduleFor.set(term);
    this.schedule.set(null);
    this.loadSchedule();
  }

  protected loadSchedule(): void {
    const term = this.scheduleFor();
    if (!term || !DECIMAL.test(this.scheduleAmount)) {
      return;
    }
    this.api.getPaymentTermSchedule(term.id, { amount: this.scheduleAmount }).subscribe({
      next: (res) => this.schedule.set(res.data),
    });
  }

  protected scheduleJson(): string {
    return JSON.stringify(this.schedule() ?? {}, null, 2);
  }

  // Brands, categories and units
  protected openSimple(kind: 'brand' | 'category' | 'unit', item?: { id: string; name: string; code?: string; parent_id?: string | null }): void {
    this.simpleOpen.set(kind);
    this.editingId.set(item?.id ?? null);
    this.simpleName = item?.name ?? '';
    this.simpleCode = item?.code ?? '';
    this.simpleParent = item?.parent_id ?? null;
  }

  protected simpleValid(): boolean {
    return this.simpleName.trim().length > 0 && (this.simpleOpen() !== 'unit' || this.simpleCode.trim().length > 0);
  }

  protected saveSimple(): void {
    const kind = this.simpleOpen();
    const id = this.editingId();
    const name = this.simpleName.trim();
    const request =
      kind === 'brand'
        ? id
          ? this.api.updateBrand(id, name)
          : this.api.createBrand(name)
        : kind === 'category'
          ? id
            ? this.api.updateCategory(id, { name, parent_id: this.simpleParent })
            : this.api.createCategory({ name, parent_id: this.simpleParent })
          : id
            ? this.api.updateUnit(id, { code: this.simpleCode.trim(), name })
            : this.api.createUnit({ code: this.simpleCode.trim(), name });
    request.subscribe({
      next: () => {
        this.simpleOpen.set(null);
        this.message.success(this.i18n.translate('CAT.SAVED'));
        this.loadAll();
      },
    });
  }

  protected removeSimple(kind: 'brand' | 'category' | 'unit', id: string): void {
    const request =
      kind === 'brand' ? this.api.deleteBrand(id) : kind === 'category' ? this.api.deleteCategory(id) : this.api.deleteUnit(id);
    request.subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CAT.DELETED'));
        this.loadAll();
      },
    });
  }
}
