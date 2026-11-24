import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  serverErrorMessage,
  SupplierDocument,
  SupplierDocumentRequirement,
  SupplierDocumentStatus,
  SupplierPortalApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { downloadBlob } from '@shared/utils/download-blob';
import { validationTipKey } from '@shared/utils/validation-tip';
import { DOCUMENT_STATUS_COLORS, DOCUMENT_STATUS_LABELS, expiryColor } from './supplier-portal.utils';

/** Supplier documents with their expiry: review (accept with the expiry date, or reject with a reason) and the catalogue of required types. */
@Component({
  selector: 'app-supplier-documents',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'SUPPLIER_PORTAL.PAGE_DOCUMENTS' | translate" [subtitle]="'SUPPLIER_PORTAL.DOCUMENTS_SUBTITLE' | translate" />

    <nz-card [nzTitle]="'SUPPLIER_PORTAL.SUPPLIER_DOCUMENTS' | translate">
      <div class="toolbar">
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)" nzAllowClear [nzPlaceHolder]="'SUPPLIER_PORTAL.ALL_STATUSES' | translate" class="filter">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="statusLabels[status] | translate"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="expiringFilter()" (ngModelChange)="setExpiringFilter($event)" nzAllowClear [nzPlaceHolder]="'SUPPLIER_PORTAL.ANY_EXPIRY' | translate" class="filter">
          @for (days of expiryWindows; track days) {
            <nz-option [nzValue]="days" [nzLabel]="('SUPPLIER_PORTAL.EXPIRING_WITHIN' | translate: { value: days })"></nz-option>
          }
        </nz-select>
      </div>

      <nz-table #table [nzData]="documents()" [nzLoading]="loading()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.DOCUMENT' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.REFERENCE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.EXPIRES_AT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (document of table.data; track document.id) {
            <tr>
              <td>{{ document.supplier_name }}</td>
              <td>{{ document.requirement_name }}</td>
              <td>{{ document.reference }}</td>
              <td>
                <nz-tag [nzColor]="statusColors[document.status]">{{ statusLabels[document.status] | translate }}</nz-tag>
                @if (document.rejection_reason) {
                  <div class="reason">{{ document.rejection_reason }}</div>
                }
              </td>
              <td>
                @if (document.expires_at) {
                  <nz-tag [nzColor]="expiryColor(document.days_to_expiry)">{{ document.expires_at | date: 'dd/MM/yyyy' }}</nz-tag>
                }
              </td>
              <td class="row-actions">
                @if (document.has_file) {
                  <button nz-button nzSize="small" (click)="download(document)">{{ 'SUPPLIER_PORTAL.DOWNLOAD' | translate }}</button>
                }
                @if (document.status === 'submitted') {
                  <button nz-button nzSize="small" nzType="primary" (click)="openAccept(document)">{{ 'SUPPLIER_PORTAL.ACCEPT' | translate }}</button>
                  <button nz-button nzSize="small" nzDanger (click)="openReject(document)">{{ 'SUPPLIER_PORTAL.REJECT' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'SUPPLIER_PORTAL.REQUIRED_DOCUMENT_TYPES' | translate" class="requirements-card">
      <div class="toolbar">
        <button nz-button (click)="seedDefaults()">{{ 'SUPPLIER_PORTAL.CREATE_DEFAULT_TYPES' | translate }}</button>
      </div>
      <nz-table #typeTable [nzData]="requirements()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.CODE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.DOCUMENT' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.COUNTRY' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.MANDATORY' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.VALIDITY_DAYS' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.ALERT_DAYS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (type of typeTable.data; track type.id) {
            <tr>
              <td>{{ type.code }}</td>
              <td>{{ type.name }}</td>
              <td>{{ type.country ?? ('SUPPLIER_PORTAL.ALL_COUNTRIES' | translate) }}</td>
              <td>{{ (type.is_mandatory ? 'SUPPLIER_PORTAL.YES' : 'SUPPLIER_PORTAL.NO') | translate }}</td>
              <td>{{ type.validity_days }}</td>
              <td>{{ type.alert_days }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal appModalActions
      [nzVisible]="acceptVisible()"
      [nzTitle]="'SUPPLIER_PORTAL.ACCEPT_DOCUMENT' | translate"
      (nzOnCancel)="acceptVisible.set(false)"
      (nzOnOk)="confirmAccept()"
      [nzOkDisabled]="acceptForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="acceptForm">
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.REFERENCE' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="reference" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.ISSUED_AT' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input type="date" formControlName="issued_at" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.EXPIRES_AT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(acceptForm, 'expires_at')">
              <input nz-input type="date" formControlName="expires_at" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [nzVisible]="rejectVisible()"
      [nzTitle]="'SUPPLIER_PORTAL.REJECT_DOCUMENT' | translate"
      (nzOnCancel)="rejectVisible.set(false)"
      (nzOnOk)="confirmReject()"
      [nzOkDisabled]="rejectForm.invalid"
      [nzOkDanger]="true"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="rejectForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.REASON' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(rejectForm, 'reason')">
              <textarea nz-input rows="3" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .filter {
      min-width: 200px;
    }
    .requirements-card {
      margin-top: 16px;
    }
    .row-actions {
      display: flex;
      gap: 4px;
    }
    .reason {
      font-size: 12px;
      opacity: 0.75;
    }
  `,
})
export class SupplierDocumentsComponent implements OnInit {
  private readonly api = inject(SupplierPortalApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly documents = signal<SupplierDocument[]>([]);
  readonly requirements = signal<SupplierDocumentRequirement[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<SupplierDocumentStatus | null>('submitted');
  readonly expiringFilter = signal<number | null>(null);
  readonly selected = signal<SupplierDocument | null>(null);
  readonly acceptVisible = signal(false);
  readonly rejectVisible = signal(false);

  readonly acceptForm = this.fb.group({ reference: [''], issued_at: [''], expires_at: [''] });
  readonly rejectForm = this.fb.group({ reason: ['', Validators.required] });

  readonly statuses = Object.keys(DOCUMENT_STATUS_LABELS) as SupplierDocumentStatus[];
  readonly statusLabels = DOCUMENT_STATUS_LABELS;
  readonly statusColors = DOCUMENT_STATUS_COLORS;
  readonly expiryWindows = [30, 60, 90];
  readonly expiryColor = expiryColor;

  ngOnInit(): void {
    this.load();
    this.loadRequirements();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getDocuments({ status: this.statusFilter() ?? undefined, expiring_within_days: this.expiringFilter() ?? undefined, per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.documents.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
        },
      });
  }

  setStatusFilter(status: SupplierDocumentStatus | null): void {
    this.statusFilter.set(status);
    this.load();
  }

  setExpiringFilter(days: number | null): void {
    this.expiringFilter.set(days);
    this.load();
  }

  seedDefaults(): void {
    this.api
      .seedDocumentRequirements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.DEFAULT_TYPES_CREATED', { value: result.created }));
          this.loadRequirements();
        },
        error: () => this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR')),
      });
  }

  download(document: SupplierDocument): void {
    this.api
      .downloadDocument(document.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => downloadBlob(blob, document.original_name ?? 'document'),
        error: () => this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR')),
      });
  }

  openAccept(document: SupplierDocument): void {
    this.selected.set(document);
    this.acceptForm.reset({ reference: document.reference ?? '', issued_at: document.issued_at ?? '', expires_at: document.expires_at ?? '' });
    this.acceptVisible.set(true);
  }

  confirmAccept(): void {
    const document = this.selected();
    if (!document) {
      return;
    }
    const value = this.acceptForm.getRawValue();
    this.api
      .acceptDocument(document.id, { reference: value.reference || null, issued_at: value.issued_at || null, expires_at: value.expires_at || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acceptVisible.set(false);
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.DOCUMENT_ACCEPTED'));
          this.load();
        },
        error: (error: unknown) => this.fail(this.acceptForm, error),
      });
  }

  openReject(document: SupplierDocument): void {
    this.selected.set(document);
    this.rejectForm.reset({ reason: '' });
    this.rejectVisible.set(true);
  }

  confirmReject(): void {
    const document = this.selected();
    if (!document || this.rejectForm.invalid) {
      return;
    }
    this.api
      .rejectDocument(document.id, { reason: this.rejectForm.getRawValue().reason.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rejectVisible.set(false);
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.DOCUMENT_REJECTED'));
          this.load();
        },
        error: (error: unknown) => this.fail(this.rejectForm, error),
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

  private loadRequirements(): void {
    this.api
      .getDocumentRequirements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.requirements.set(response.data) });
  }

  private fail(form: FormGroup, error: unknown): void {
    const body = (error as { error?: { detail?: string; message?: string } })?.error;
    this.message.error(body?.detail ?? body?.message ?? this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
    form.markAllAsTouched();
  }
}
