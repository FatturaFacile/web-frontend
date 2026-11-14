import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  ProcurementApiService,
  ProcurementSupplier,
  serverErrorMessage,
  SupplierPortalApiService,
  SupplierQualificationAssessment,
  SupplierQualificationCriterion,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { validationTipKey } from '@shared/utils/validation-tip';

const OUTCOME_COLORS: Readonly<Record<string, string>> = { qualified: 'green', conditional: 'gold', not_qualified: 'red' };
const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  qualified: 'SUPPLIER_PORTAL.OUTCOME_QUALIFIED',
  conditional: 'SUPPLIER_PORTAL.OUTCOME_CONDITIONAL',
  not_qualified: 'SUPPLIER_PORTAL.OUTCOME_NOT_QUALIFIED',
};

/** Qualification: the weighted checklist of the company and the scoring of a supplier against it. */
@Component({
  selector: 'app-supplier-qualification',
  imports: [
    ReactiveFormsModule,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'SUPPLIER_PORTAL.PAGE_QUALIFICATION' | translate" [subtitle]="'SUPPLIER_PORTAL.QUALIFICATION_SUBTITLE' | translate">
      <button nz-button nzType="primary" [disabled]="activeCriteria().length === 0" (click)="openAssessment()">{{ 'SUPPLIER_PORTAL.NEW_ASSESSMENT' | translate }}</button>
    </app-page-header>

    <nz-card [nzTitle]="'SUPPLIER_PORTAL.CHECKLIST' | translate" [nzExtra]="addCriterionButton">
      <ng-template #addCriterionButton>
        <button nz-button (click)="openCriterion(null)">{{ 'SUPPLIER_PORTAL.ADD_CRITERION' | translate }}</button>
      </ng-template>
      <nz-table #criteriaTable [nzData]="criteria()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.CODE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.CRITERION' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.WEIGHT' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.MAX_SCORE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.ACTIVE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (criterion of criteriaTable.data; track criterion.id) {
            <tr>
              <td>{{ criterion.code }}</td>
              <td>{{ criterion.name }}</td>
              <td>{{ criterion.weight }}</td>
              <td>{{ criterion.max_score }}</td>
              <td>{{ (criterion.is_active ? 'SUPPLIER_PORTAL.YES' : 'SUPPLIER_PORTAL.NO') | translate }}</td>
              <td>
                <button nz-button nzSize="small" (click)="openCriterion(criterion)">{{ 'SUPPLIER_PORTAL.EDIT' | translate }}</button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <p class="total-weight">{{ 'SUPPLIER_PORTAL.TOTAL_WEIGHT' | translate }}: {{ totalWeight() }}</p>
    </nz-card>

    <nz-card [nzTitle]="'SUPPLIER_PORTAL.ASSESSMENTS' | translate" class="assessments-card">
      <nz-table #assessmentTable [nzData]="assessments()" [nzLoading]="loading()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.SCORE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.BAND' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.OUTCOME' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (assessment of assessmentTable.data; track assessment.id) {
            <tr>
              <td>{{ supplierName(assessment.supplier_id) }}</td>
              <td>{{ (assessment.status === 'draft' ? 'SUPPLIER_PORTAL.ASSESSMENT_DRAFT' : 'SUPPLIER_PORTAL.ASSESSMENT_COMPLETED') | translate }}</td>
              <td>{{ assessment.total_score }}</td>
              <td>{{ assessment.band }}</td>
              <td>
                @if (assessment.outcome; as outcome) {
                  <nz-tag [nzColor]="outcomeColors[outcome]">{{ outcomeLabels[outcome] | translate }}</nz-tag>
                }
              </td>
              <td>
                @if (assessment.status === 'draft') {
                  <button nz-button nzSize="small" nzType="primary" (click)="complete(assessment)">{{ 'SUPPLIER_PORTAL.COMPLETE' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="criterionVisible()"
      [nzTitle]="'SUPPLIER_PORTAL.CRITERION' | translate"
      (nzOnCancel)="criterionVisible.set(false)"
      (nzOnOk)="saveCriterion()"
      okAction="save"
      [nzOkDisabled]="criterionForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="criterionForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.CODE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(criterionForm, 'code')">
              <input nz-input formControlName="code" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.CRITERION' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(criterionForm, 'name')">
              <input nz-input formControlName="name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.WEIGHT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(criterionForm, 'weight')">
              <input nz-input formControlName="weight" inputmode="decimal" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.MAX_SCORE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(criterionForm, 'max_score')">
              <nz-input-number formControlName="max_score" [nzMin]="1" [nzMax]="100"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="assessmentVisible()"
      [nzTitle]="'SUPPLIER_PORTAL.NEW_ASSESSMENT' | translate"
      (nzOnCancel)="assessmentVisible.set(false)"
      (nzOnOk)="saveAssessment()"
      okAction="save"
      [nzOkDisabled]="assessmentForm.invalid || scoreForm().invalid"
      nzWidth="640px"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="assessmentForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(assessmentForm, 'supplier_id')">
              <nz-select formControlName="supplier_id" nzShowSearch>
                @for (supplier of suppliers(); track supplier.id) {
                  <nz-option [nzValue]="supplier.id" [nzLabel]="supplier.company_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
        <form nz-form nzLayout="vertical" [formGroup]="scoreForm()">
          @for (criterion of activeCriteria(); track criterion.id) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ criterion.name }} (x{{ criterion.weight }}, 0-{{ criterion.max_score }})</nz-form-label>
              <nz-form-control>
                <nz-input-number [formControlName]="criterion.id" [nzMin]="0" [nzMax]="criterion.max_score" [nzStep]="0.5"></nz-input-number>
              </nz-form-control>
            </nz-form-item>
          }
        </form>
        <form nz-form nzLayout="vertical" [formGroup]="assessmentForm">
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="2" formControlName="notes"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .assessments-card {
      margin-top: 16px;
    }
    .total-weight {
      margin: 12px 0 0;
      font-weight: 600;
    }
  `,
})
export class SupplierQualificationComponent implements OnInit {
  private readonly api = inject(SupplierPortalApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly criteria = signal<SupplierQualificationCriterion[]>([]);
  readonly assessments = signal<SupplierQualificationAssessment[]>([]);
  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly loading = signal(false);
  readonly activeCriteria = computed(() => this.criteria().filter((criterion) => criterion.is_active));
  readonly totalWeight = computed(() => this.activeCriteria().reduce((sum, criterion) => sum + Math.round(Number(criterion.weight) * 100), 0) / 100);

  readonly criterionVisible = signal(false);
  readonly assessmentVisible = signal(false);
  private editedCriterionId: string | null = null;

  readonly criterionForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', Validators.required],
    weight: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    max_score: [5, [Validators.required, Validators.min(1)]],
  });
  readonly assessmentForm = this.fb.group({ supplier_id: ['', Validators.required], notes: [''] });
  readonly scoreForm = signal(new FormGroup<Record<string, FormControl<number>>>({}));

  readonly outcomeColors = OUTCOME_COLORS;
  readonly outcomeLabels = OUTCOME_LABELS;

  ngOnInit(): void {
    this.load();
    this.procurement
      .getSuppliers({ per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.suppliers.set(response.data) });
  }

  supplierName(supplierId: string): string {
    return this.suppliers().find((supplier) => supplier.id === supplierId)?.company_name ?? supplierId;
  }

  openCriterion(criterion: SupplierQualificationCriterion | null): void {
    this.editedCriterionId = criterion?.id ?? null;
    this.criterionForm.reset({ code: criterion?.code ?? '', name: criterion?.name ?? '', weight: criterion?.weight ?? '', max_score: criterion?.max_score ?? 5 });
    this.criterionVisible.set(true);
  }

  saveCriterion(): void {
    if (this.criterionForm.invalid) {
      return;
    }
    const payload = this.criterionForm.getRawValue();
    const request$ = this.editedCriterionId ? this.api.updateCriterion(this.editedCriterionId, payload) : this.api.createCriterion(payload);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.criterionVisible.set(false);
        this.message.success(this.translate.instant('SUPPLIER_PORTAL.CRITERION_SAVED'));
        this.load();
      },
      error: (error: unknown) => this.fail(this.criterionForm, error),
    });
  }

  openAssessment(): void {
    this.assessmentForm.reset({ supplier_id: '', notes: '' });
    this.scoreForm.set(
      new FormGroup(
        Object.fromEntries(
          this.activeCriteria().map((criterion) => [
            criterion.id,
            new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(criterion.max_score)] }),
          ]),
        ),
      ),
    );
    this.assessmentVisible.set(true);
  }

  saveAssessment(): void {
    if (this.assessmentForm.invalid || this.scoreForm().invalid) {
      return;
    }
    const value = this.assessmentForm.getRawValue();
    const scores = Object.entries(this.scoreForm().getRawValue()).map(([criterion_id, score]) => ({ criterion_id, score }));
    this.api
      .createAssessment({ supplier_id: value.supplier_id, notes: value.notes || null, scores })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.assessmentVisible.set(false);
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.ASSESSMENT_SAVED'));
          this.load();
        },
        error: (error: unknown) => this.fail(this.assessmentForm, error),
      });
  }

  complete(assessment: SupplierQualificationAssessment): void {
    this.api
      .completeAssessment(assessment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.ASSESSMENT_COMPLETED_MESSAGE', { value: response.data.total_score ?? '' }));
          this.load();
        },
        error: (error: unknown) => this.fail(this.assessmentForm, error),
      });
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getCriteria()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.criteria.set(response.data) });
    this.api
      .getAssessments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assessments.set(response.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private fail(form: FormGroup, error: unknown): void {
    const body = (error as { error?: { detail?: string; message?: string } })?.error;
    this.message.error(body?.detail ?? body?.message ?? this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
    form.markAllAsTouched();
  }
}
