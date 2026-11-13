import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  applyServerErrors,
  EMPLOYEE_DOCUMENT_TYPES,
  EmployeeDocumentResource,
  EmployeeDocumentType,
  HrEmployeeApiService,
  I18nService,
  isValidationError,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

/** Personnel file: documents with health flag, visibility to the employee and retention date. */
@Component({
  selector: 'app-employee-documents',
  styleUrl: './employee-documents.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    DatePipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './employee-documents.component.html',
})
export class EmployeeDocumentsComponent implements OnInit {
  readonly employeeId = input.required<string>();

  private readonly api = inject(HrEmployeeApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly documents = signal<EmployeeDocumentResource[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly fileMissing = signal(false);
  protected readonly typeOptions = EMPLOYEE_DOCUMENT_TYPES;

  protected readonly form = this.fb.group({
    document_type: ['other' as EmployeeDocumentType, Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    issue_date: [''],
    expiry_date: [''],
    retention_until: [''],
    contains_health_data: [false],
    is_confidential: [false],
    visible_to_employee: [false],
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getEmployeeDocuments(this.employeeId()).subscribe({
      next: (res) => {
        this.documents.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected openForm(): void {
    this.form.reset();
    this.file.set(null);
    this.fileMissing.set(false);
    this.formOpen.set(true);
  }

  protected onFileSelected(event: Event): void {
    const selected = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.file.set(selected);
    this.fileMissing.set(selected === null);
  }

  protected upload(): void {
    const file = this.file();
    if (this.form.invalid || !file) {
      this.fileMissing.set(!file);
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .uploadEmployeeDocument(this.employeeId(), {
        file,
        document_type: value.document_type,
        title: value.title,
        issue_date: value.issue_date || null,
        expiry_date: value.expiry_date || null,
        retention_until: value.retention_until || null,
        contains_health_data: value.contains_health_data,
        is_confidential: value.is_confidential,
        visible_to_employee: value.visible_to_employee,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.message.success(this.i18n.translate('hrmCommon.saved'));
          this.reload();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          if (isValidationError(err)) {
            applyServerErrors(this.form, err);
          } else {
            reportHttpError(err, this.message, this.i18n);
          }
        },
      });
  }

  protected download(doc: EmployeeDocumentResource): void {
    this.api.downloadEmployeeDocument(doc.id).subscribe({
      next: (blob) => saveBlob(blob, doc.original_name ?? doc.title),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected remove(doc: EmployeeDocumentResource): void {
    this.api.deleteEmployeeDocument(doc.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmCommon.deleted'));
        this.reload();
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
