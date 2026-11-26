import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  RefurbishedItem,
  ReturnGrade,
  ReturnGradingDisposition,
  ReturnGradingInspection,
  ReturnsApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText } from './returns.util';

/** Return Inspection, A/B/C/Scrap Grading & Refurbished B-Stock SKU Workbench. */
@Component({
  selector: 'app-returns-grading-bench',
  styleUrl: './returns.scss',
  imports: [
    ReactiveFormsModule,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS_RL.GRADING_TITLE' | translate" [subtitle]="'RETURNS_RL.GRADING_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()">{{ 'RETURNS_RL.NEW_GRADING' | translate }}</button>
    </app-page-header>

    <nz-tabs>
      <nz-tab [nzTitle]="'RETURNS_RL.GRADING_TITLE' | translate">
        <nz-card class="main-card">
          <nz-table #inspTable [nzData]="inspections()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'RETURNS.RMA_NUMBER' | translate }}</th>
                <th>{{ 'RETURNS.PRODUCT' | translate }}</th>
                <th>{{ 'RETURNS_RL.GRADE' | translate }}</th>
                <th>{{ 'RETURNS.DISPOSITION' | translate }}</th>
                <th class="num">{{ 'RETURNS_RL.DEVALUATION_PERCENT' | translate }}</th>
                <th class="num">{{ 'RETURNS_RL.REVALUED_COST' | translate }}</th>
                <th>{{ 'RETURNS_RL.REFURBISHED_SKU' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of inspTable.data; track row.id) {
                <tr>
                  <td>{{ row.inspection_number }}</td>
                  <td>{{ row.product_name }}</td>
                  <td><nz-tag [nzColor]="gradeColor(row.grade)">{{ ('RETURNS_RL.' + row.grade.toUpperCase()) | translate }}</nz-tag></td>
                  <td>{{ row.disposition }}</td>
                  <td class="num">{{ row.devaluation_percent }}%</td>
                  <td class="num">{{ row.revalued_unit_cost }}</td>
                  <td>{{ row.refurbished_sku ?? '-' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!loading() && inspections().length === 0) {
            <nz-empty [nzNotFoundContent]="'RETURNS.NO_DATA' | translate"></nz-empty>
          }
        </nz-card>
      </nz-tab>

      <nz-tab [nzTitle]="'RETURNS_RL.REFURBISHED_SKU' | translate">
        <nz-card class="main-card">
          <nz-table #refTable [nzData]="refurbishedItems()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'RETURNS_RL.REFURBISHED_SKU' | translate }}</th>
                <th>{{ 'RETURNS.PRODUCT' | translate }}</th>
                <th>{{ 'RETURNS_RL.GRADE' | translate }}</th>
                <th class="num">{{ 'RETURNS_RL.REVALUED_COST' | translate }}</th>
                <th>{{ 'RETURNS_RL.WORK_ORDER_STATUS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of refTable.data; track item.id) {
                <tr>
                  <td><code>{{ item.refurbished_sku }}</code></td>
                  <td>{{ item.original_product_name }}</td>
                  <td><nz-tag [nzColor]="gradeColor(item.grade)">{{ ('RETURNS_RL.' + item.grade.toUpperCase()) | translate }}</nz-tag></td>
                  <td class="num">{{ item.new_unit_cost }}</td>
                  <td><nz-tag>{{ item.work_order_status }}</nz-tag></td>
                  <td>
                    @if (item.work_order_status !== 'completed') {
                      <button nz-button nzSize="small" (click)="completeWorkOrder(item)">
                        {{ 'RETURNS_RL.COMPLETE_WORK_ORDER' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      </nz-tab>
    </nz-tabs>

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="'RETURNS_RL.NEW_GRADING' | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="720px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.PRODUCT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="product_id" nzShowSearch nzServerSearch (nzOnSearch)="lookups.searchProducts($event)">
                  @for (product of lookups.products(); track product.id) {
                    <nz-option [nzValue]="product.id" [nzLabel]="product.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS_RL.GRADE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="grade">
                  @for (g of grades; track g) {
                    <nz-option [nzValue]="g" [nzLabel]="('RETURNS_RL.' + g.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.DISPOSITION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="disposition">
                  @for (d of dispositions; track d) {
                    <nz-option [nzValue]="d" [nzLabel]="d"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0.01" step="any" formControlName="quantity_inspected" /></nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label>{{ 'RETURNS_RL.DEVALUATION_PERCENT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" max="100" step="any" formControlName="devaluation_percent" /></nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label>{{ 'RETURNS.SUPPLIER' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="supplier_id" nzAllowClear nzShowSearch>
                  @for (sup of lookups.suppliers(); track sup.id) {
                    <nz-option [nzValue]="sup.id" [nzLabel]="sup.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="form-row">
            <label nz-checkbox for="ret-grd-pkg-intact" nzId="ret-grd-pkg-intact" formControlName="package_intact">{{ 'RETURNS_RL.CHECKLIST_PACKAGE_INTACT' | translate }}</label>
            <label nz-checkbox for="ret-grd-acc-complete" nzId="ret-grd-acc-complete" formControlName="accessories_complete">{{ 'RETURNS_RL.CHECKLIST_ACCESSORIES_COMPLETE' | translate }}</label>
            <label nz-checkbox for="ret-grd-func-test" nzId="ret-grd-func-test" formControlName="functional_test_passed">{{ 'RETURNS_RL.CHECKLIST_FUNCTIONAL_TEST' | translate }}</label>
          </div>

          <nz-form-item style="margin-top: 12px;">
            <nz-form-label nzRequired>{{ 'RETURNS_RL.PHOTO_EVIDENCE' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="photo_urls_text" />
              <div class="muted">{{ 'RETURNS_RL.MANDATORY_PHOTOS_HINT' | translate }}</div>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsGradingBenchComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly grades: readonly ReturnGrade[] = ['grade_a', 'grade_b', 'grade_c', 'scrap_or_supplier'];
  readonly dispositions: readonly ReturnGradingDisposition[] = ['restock_primary', 'convert_b_stock', 'return_to_supplier', 'scrap'];
  readonly inspections = signal<ReturnGradingInspection[]>([]);
  readonly refurbishedItems = signal<RefurbishedItem[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);

  readonly form = this.fb.group({
    product_id: ['', [Validators.required]],
    grade: ['grade_b' as ReturnGrade, [Validators.required]],
    disposition: ['convert_b_stock' as ReturnGradingDisposition, [Validators.required]],
    quantity_inspected: [1, [Validators.required, Validators.min(0.01)]],
    devaluation_percent: ['20'],
    supplier_id: [''],
    package_intact: [false],
    accessories_complete: [true],
    functional_test_passed: [true],
    photo_urls_text: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
  }

  gradeColor(grade: string): string {
    switch (grade) {
      case 'grade_a':
        return 'green';
      case 'grade_b':
        return 'blue';
      case 'grade_c':
        return 'orange';
      default:
        return 'red';
    }
  }

  load(): void {
    this.loading.set(true);
    this.api.getGradingInspections({ per_page: 50 }).subscribe({
      next: (res) => {
        this.inspections.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.getRefurbishedItems({ per_page: 50 }).subscribe({
      next: (res) => this.refurbishedItems.set(res.data),
    });
  }

  openCreate(): void {
    this.lookups.searchProducts();
    this.lookups.loadSuppliers();
    this.modalVisible.set(true);
  }

  save(): void {
    const val = this.form.getRawValue();
    const photos = val.photo_urls_text.split(',').map((u) => u.trim()).filter((u) => u !== '');
    this.api.createGradingInspection({
      product_id: val.product_id,
      grade: val.grade,
      disposition: val.disposition,
      quantity_inspected: Number(val.quantity_inspected),
      devaluation_percent: val.devaluation_percent !== '' ? Number(val.devaluation_percent) : null,
      supplier_id: val.supplier_id || null,
      checklist: {
        package_intact: val.package_intact,
        accessories_complete: val.accessories_complete,
        functional_test_passed: val.functional_test_passed,
      },
      photo_urls: photos,
    }).subscribe({
      next: () => {
        this.modalVisible.set(false);
        this.load();
        this.message.success(this.translate.instant('RETURNS.RMA_INSPECTED'));
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  completeWorkOrder(item: RefurbishedItem): void {
    this.api.completeRefurbishedWorkOrder(item.id, { work_order_status: 'completed' }).subscribe({
      next: (res) => {
        this.refurbishedItems.update((list) => list.map((x) => (x.id === item.id ? res.data : x)));
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
