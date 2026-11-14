import { DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable, of, tap } from 'rxjs';
import {
  DocumentSignature,
  DocumentSigningSettings,
  DocumentTrustApiService,
  DocumentTrustType,
  EDocumentNetworkStatus,
  EDocumentNetworkType,
  EDocumentTransmission,
  FetchGridModel,
  I18nService,
  PaginatedResponse,
  PreservationRecord,
  PreserveDocumentRequest,
  SendEDocumentRequest,
  serverErrorMessage,
  SignDocumentRequest,
  TransmissionListParams,
  TranslateService,
  UpdateDocumentSigningSettingsRequest,
  VerifySignatureResult,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { uuidFormat } from '@shared/utils/uuid-validator';

/** Query of the lookup grids: the document the user looked up plus the paging and grid parameters. */
interface DocumentLookupParams {
  document_id?: string;
  page?: number;
  per_page?: number;
  search?: string;
}

/** Page the lookup grids show before a document id was typed: nothing is requested. */
function emptyPage<T>(): Observable<PaginatedResponse<T>> {
  return of({
    success: true,
    message: '',
    data: [],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 0, from: null, to: null },
  } as unknown as PaginatedResponse<T>);
}

@Component({
  selector: 'app-document-trust',
  styleUrl: './document-trust.component.scss',
  imports: [
    ModalActionsDirective,
    IconActionDirective,
    DatePipe,
    SlicePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    BaseTableComponent,
    NzTagModule,
    NzBadgeModule,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDescriptionsModule,
    NzAlertModule,
    NzSpinModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './document-trust.component.html',
})
export class DocumentTrustComponent implements OnInit {
  private readonly api = inject(DocumentTrustApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal<boolean>(false);
  readonly selectedTabIndex = signal<number>(0);

  // Networks & Transmissions
  readonly networks = signal<EDocumentNetworkStatus[]>([]);
  /** Server-side grids: paging, sorting, column filters, grouping and export run over the whole list. */
  readonly transmissionGrid = new FetchGridModel<EDocumentTransmission, TransmissionListParams>((query) =>
    this.api.getTransmissions(query).pipe(
      tap({ error: () => this.message.error(this.translate.instant('DOCUMENT_TRUST.TRANSMISSIONS_LOAD_ERROR')) }),
    ),
  );
  readonly selectedTransmission = signal<EDocumentTransmission | null>(null);
  readonly isTransmissionDrawerVisible = signal<boolean>(false);

  // Filters for transmissions
  readonly filterNetwork = signal<string>('');
  readonly filterStatus = signal<string>('');
  readonly filterRef = signal<string>('');

  // Signatures
  readonly lookupDocumentId = signal<string>('');
  readonly signatureGrid = new FetchGridModel<DocumentSignature, DocumentLookupParams>(({ document_id, ...query }) =>
    document_id ? this.api.getSignatures(document_id, query) : emptyPage<DocumentSignature>(),
  );
  readonly verificationResult = signal<VerifySignatureResult | null>(null);
  readonly isVerificationModalVisible = signal<boolean>(false);

  // Preservation
  readonly preservationLookupDocumentId = signal<string>('');
  readonly preservationGrid = new FetchGridModel<PreservationRecord, DocumentLookupParams>(({ document_id, ...query }) =>
    document_id ? this.api.getPreservationRecords(document_id, query) : emptyPage<PreservationRecord>(),
  );

  // Settings
  readonly signingSettings = signal<DocumentSigningSettings | null>(null);

  // Modals & Forms
  readonly isSendModalVisible = signal<boolean>(false);
  readonly isSignModalVisible = signal<boolean>(false);
  readonly isPreserveModalVisible = signal<boolean>(false);

  readonly sendForm: FormGroup = this.fb.group({
    network: ['peppol', [Validators.required]],
    document_reference: ['', [Validators.required, Validators.maxLength(190)]],
    recipient_identifier: ['', [Validators.required, Validators.maxLength(190)]],
    payload: ['', [Validators.required]],
  });

  readonly signForm: FormGroup = this.fb.group({
    document_type: ['invoice' as DocumentTrustType, [Validators.required]],
    document_id: ['', [Validators.required, uuidFormat]],
  });

  readonly preserveForm: FormGroup = this.fb.group({
    document_type: ['invoice' as DocumentTrustType, [Validators.required]],
    document_id: ['', [Validators.required, uuidFormat]],
  });

  readonly settingsForm: FormGroup = this.fb.group({
    driver: ['local', [Validators.required]],
    certificate: ['', [Validators.maxLength(20000)]],
    private_key: ['', [Validators.maxLength(20000)]],
    passphrase: ['', [Validators.maxLength(255)]],
  });

  constructor() {
    this.settingsForm.controls['driver'].valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncSigningRequirements());
  }

  /** API rule `required_if:driver,cades` on the certificate and the private key. */
  readonly isCertificateRequired = (): boolean => this.settingsForm.controls['driver'].value === 'cades';

  private syncSigningRequirements(): void {
    for (const key of ['certificate', 'private_key']) {
      const control = this.settingsForm.controls[key];
      if (this.isCertificateRequired()) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    if (control?.errors) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    return '';
  }

  private readonly txNetworkTpl = viewChild<TemplateRef<{ $implicit: EDocumentTransmission; value: unknown }>>('txNetworkTpl');
  private readonly txReferenceTpl = viewChild<TemplateRef<{ $implicit: EDocumentTransmission; value: unknown }>>('txReferenceTpl');
  private readonly txRecipientTpl = viewChild<TemplateRef<{ $implicit: EDocumentTransmission; value: unknown }>>('txRecipientTpl');
  private readonly txHashTpl = viewChild<TemplateRef<{ $implicit: EDocumentTransmission; value: unknown }>>('txHashTpl');
  private readonly txStatusTpl = viewChild<TemplateRef<{ $implicit: EDocumentTransmission; value: unknown }>>('txStatusTpl');
  private readonly sigFormatTpl = viewChild<TemplateRef<{ $implicit: DocumentSignature; value: unknown }>>('sigFormatTpl');
  private readonly sigHashTpl = viewChild<TemplateRef<{ $implicit: DocumentSignature; value: unknown }>>('sigHashTpl');
  private readonly sigDateTpl = viewChild<TemplateRef<{ $implicit: DocumentSignature; value: unknown }>>('sigDateTpl');
  private readonly presHashTpl = viewChild<TemplateRef<{ $implicit: PreservationRecord; value: unknown }>>('presHashTpl');
  private readonly presDateTpl = viewChild<TemplateRef<{ $implicit: PreservationRecord; value: unknown }>>('presDateTpl');
  private readonly presStatusTpl = viewChild<TemplateRef<{ $implicit: PreservationRecord; value: unknown }>>('presStatusTpl');

  readonly transmissionColumns = computed<TableColumnDef<EDocumentTransmission>[]>(() => [
    { key: 'network', header: 'DOCUMENT_TRUST.NETWORK', customCellTemplate: this.txNetworkTpl() },
    { key: 'document_reference', header: 'DOCUMENT_TRUST.DOCUMENT_REF', customCellTemplate: this.txReferenceTpl() },
    { key: 'recipient_identifier', header: 'DOCUMENT_TRUST.RECIPIENT', customCellTemplate: this.txRecipientTpl() },
    { key: 'payload_sha256', header: 'DOCUMENT_TRUST.PAYLOAD_SHA256', customCellTemplate: this.txHashTpl() },
    { key: 'driver', header: 'DOCUMENT_TRUST.DRIVER' },
    { key: 'status', header: 'DOCUMENT_TRUST.STATUS', customCellTemplate: this.txStatusTpl() },
  ]);

  readonly signatureColumns = computed<TableColumnDef<DocumentSignature>[]>(() => [
    { key: 'document_type', header: 'DOCUMENT_TRUST.DOCUMENT_TYPE' },
    { key: 'format', header: 'DOCUMENT_TRUST.SIGNATURE_FORMAT', customCellTemplate: this.sigFormatTpl() },
    { key: 'driver', header: 'DOCUMENT_TRUST.DRIVER' },
    { key: 'content_sha256', header: 'DOCUMENT_TRUST.SIGNATURE_HASH', customCellTemplate: this.sigHashTpl() },
    { key: 'created_at', header: 'DOCUMENT_TRUST.SIGNED_AT', customCellTemplate: this.sigDateTpl() },
  ]);

  readonly preservationColumns = computed<TableColumnDef<PreservationRecord>[]>(() => [
    { key: 'document_type', header: 'DOCUMENT_TRUST.DOCUMENT_TYPE' },
    { key: 'provider', header: 'DOCUMENT_TRUST.DRIVER' },
    { key: 'content_sha256', header: 'DOCUMENT_TRUST.PACKAGE_SHA256', customCellTemplate: this.presHashTpl() },
    { key: 'created_at', header: 'DOCUMENT_TRUST.TIMESTAMPED_AT', customCellTemplate: this.presDateTpl() },
    { key: 'status', header: 'DOCUMENT_TRUST.STATUS', customCellTemplate: this.presStatusTpl() },
  ]);

  ngOnInit(): void {
    this.loadNetworks();
    this.loadSigningSettings();
  }

  loadNetworks(): void {
    this.api.getNetworks().subscribe({
      next: (res) => {
        if (res.data) {
          this.networks.set(res.data);
        }
      },
      error: () => {
        this.message.error(this.translate.instant('DOCUMENT_TRUST.NETWORKS_LOAD_ERROR'));
      },
    });
  }

  loadTransmissions(): void {
    this.transmissionGrid.reload();
  }

  onFilterChange(): void {
    this.transmissionGrid.setFilter({
      network: this.filterNetwork() || undefined,
      status: this.filterStatus() || undefined,
      document_reference: this.filterRef() || undefined,
    });
  }

  openTransmissionDetails(tx: EDocumentTransmission): void {
    this.api.getTransmission(tx.id).subscribe({
      next: (res) => {
        this.selectedTransmission.set(res.data ?? tx);
        this.isTransmissionDrawerVisible.set(true);
      },
      error: () => {
        this.selectedTransmission.set(tx);
        this.isTransmissionDrawerVisible.set(true);
      },
    });
  }

  closeTransmissionDrawer(): void {
    this.isTransmissionDrawerVisible.set(false);
    this.selectedTransmission.set(null);
  }

  openSendModal(preselectedNetwork?: EDocumentNetworkType): void {
    if (preselectedNetwork) {
      this.sendForm.patchValue({ network: preselectedNetwork });
    }
    this.isSendModalVisible.set(true);
  }

  closeSendModal(): void {
    this.isSendModalVisible.set(false);
    this.sendForm.reset({ network: 'peppol' });
  }

  submitSendDocument(): void {
    if (this.sendForm.invalid) {
      this.sendForm.markAllAsTouched();
      return;
    }
    const val = this.sendForm.value;
    const rawPayload = val.payload || '';
    let payloadBase64: string;
    try {
      payloadBase64 = typeof btoa === 'function' ? btoa(String.fromCharCode(...new TextEncoder().encode(rawPayload))) : rawPayload;
    } catch {
      payloadBase64 = rawPayload;
    }

    const req: SendEDocumentRequest = {
      document_reference: val.document_reference,
      recipient_identifier: val.recipient_identifier,
      payload_base64: payloadBase64,
    };

    this.loading.set(true);
    this.api.sendDocument(val.network, req).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('DOCUMENT_TRUST.DOCUMENT_SENT_SUCCESS'));
        this.closeSendModal();
        this.loadTransmissions();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('DOCUMENT_TRUST.DOCUMENT_SEND_FAILED'));
      },
    });
  }

  // Digital Signatures
  loadSignatures(): void {
    const docId = this.lookupDocumentId().trim();
    if (!docId) {
      return;
    }
    if (this.signatureGrid.filterParams().document_id === docId) {
      this.signatureGrid.reload();
    } else {
      this.signatureGrid.setFilter({ document_id: docId });
    }
  }

  openSignModal(): void {
    this.signForm.reset({
      document_type: 'invoice',
      document_id: this.lookupDocumentId() || '',
    });
    this.isSignModalVisible.set(true);
  }

  closeSignModal(): void {
    this.isSignModalVisible.set(false);
  }

  submitSignDocument(): void {
    if (this.signForm.invalid) {
      this.signForm.markAllAsTouched();
      return;
    }
    const val = this.signForm.value;
    const req: SignDocumentRequest = {
      document_type: val.document_type,
      document_id: val.document_id,
    };

    this.loading.set(true);
    this.api.signDocument(req).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('DOCUMENT_TRUST.SIGNATURE_APPLIED_SUCCESS'));
        this.closeSignModal();
        this.lookupDocumentId.set(val.document_id);
        this.loadSignatures();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('DOCUMENT_TRUST.SIGNATURE_APPLIED_FAILED'));
      },
    });
  }

  verifySignature(sig: DocumentSignature): void {
    this.loading.set(true);
    this.api.verifySignature(sig.id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.verificationResult.set(res.data ?? null);
        this.isVerificationModalVisible.set(true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('DOCUMENT_TRUST.VERIFICATION_FAILED'));
      },
    });
  }

  closeVerificationModal(): void {
    this.isVerificationModalVisible.set(false);
    this.verificationResult.set(null);
  }

  // Legal Preservation
  loadPreservationRecords(): void {
    const docId = this.preservationLookupDocumentId().trim();
    if (!docId) {
      return;
    }
    if (this.preservationGrid.filterParams().document_id === docId) {
      this.preservationGrid.reload();
    } else {
      this.preservationGrid.setFilter({ document_id: docId });
    }
  }

  openPreserveModal(): void {
    this.preserveForm.reset({
      document_type: 'invoice',
      document_id: this.preservationLookupDocumentId() || '',
    });
    this.isPreserveModalVisible.set(true);
  }

  closePreserveModal(): void {
    this.isPreserveModalVisible.set(false);
  }

  submitPreserveDocument(): void {
    if (this.preserveForm.invalid) {
      this.preserveForm.markAllAsTouched();
      return;
    }
    const val = this.preserveForm.value;
    const req: PreserveDocumentRequest = {
      document_type: val.document_type,
      document_id: val.document_id,
    };

    this.loading.set(true);
    this.api.preserveDocument(req).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('DOCUMENT_TRUST.PRESERVATION_SUBMITTED_SUCCESS'));
        this.closePreserveModal();
        this.preservationLookupDocumentId.set(val.document_id);
        this.loadPreservationRecords();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('DOCUMENT_TRUST.PRESERVATION_SUBMITTED_FAILED'));
      },
    });
  }

  // Document Signing Settings
  loadSigningSettings(): void {
    this.api.getSigningSettings().subscribe({
      next: (res) => {
        if (res.data) {
          this.signingSettings.set(res.data);
          this.settingsForm.patchValue({
            driver: res.data.driver,
          });
        }
      },
      error: () => undefined,
    });
  }

  submitSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    const val = this.settingsForm.value;
    const req: UpdateDocumentSigningSettingsRequest = {
      driver: val.driver,
      certificate: val.certificate || null,
      private_key: val.private_key || null,
      passphrase: val.passphrase || null,
    };

    this.loading.set(true);
    this.api.updateSigningSettings(req).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.message.success(this.translate.instant('DOCUMENT_TRUST.SETTINGS_UPDATED_SUCCESS'));
        if (res.data) {
          this.signingSettings.set(res.data);
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('DOCUMENT_TRUST.SETTINGS_UPDATE_FAILED'));
      },
    });
  }

  getStatusBadgeColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'sent':
      case 'archived':
      case 'valid':
        return 'success';
      case 'pending':
      case 'draft':
        return 'processing';
      case 'failed':
      case 'rejected':
      case 'invalid':
        return 'error';
      default:
        return 'default';
    }
  }

  getNetworkBadgeColor(network: string): string {
    switch (network?.toLowerCase()) {
      case 'peppol':
        return 'blue';
      case 'ebill':
        return 'green';
      case 'nso':
        return 'purple';
      default:
        return 'cyan';
    }
  }
}
