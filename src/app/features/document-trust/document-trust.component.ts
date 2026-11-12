import { DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DocumentSignature,
  DocumentSigningSettings,
  DocumentTrustApiService,
  DocumentTrustType,
  EDocumentNetworkStatus,
  EDocumentNetworkType,
  EDocumentTransmission,
  PreservationRecord,
  PreserveDocumentRequest,
  SendEDocumentRequest,
  SignDocumentRequest,
  TranslateService,
  UpdateDocumentSigningSettingsRequest,
  VerifySignatureResult,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-document-trust',
  imports: [
    DatePipe,
    SlicePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzBadgeModule,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDrawerModule,
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

  readonly loading = signal<boolean>(false);
  readonly selectedTabIndex = signal<number>(0);

  // Networks & Transmissions
  readonly networks = signal<EDocumentNetworkStatus[]>([]);
  readonly transmissions = signal<EDocumentTransmission[]>([]);
  readonly selectedTransmission = signal<EDocumentTransmission | null>(null);
  readonly isTransmissionDrawerVisible = signal<boolean>(false);

  // Filters for transmissions
  readonly filterNetwork = signal<string>('');
  readonly filterStatus = signal<string>('');
  readonly filterRef = signal<string>('');

  // Signatures
  readonly lookupDocumentId = signal<string>('inv-demo-001');
  readonly signatures = signal<DocumentSignature[]>([]);
  readonly verificationResult = signal<VerifySignatureResult | null>(null);
  readonly isVerificationModalVisible = signal<boolean>(false);

  // Preservation
  readonly preservationLookupDocumentId = signal<string>('inv-demo-001');
  readonly preservationRecords = signal<PreservationRecord[]>([]);

  // Settings
  readonly signingSettings = signal<DocumentSigningSettings | null>(null);

  // Modals & Forms
  readonly isSendModalVisible = signal<boolean>(false);
  readonly isSignModalVisible = signal<boolean>(false);
  readonly isPreserveModalVisible = signal<boolean>(false);

  readonly sendForm: FormGroup = this.fb.group({
    network: ['peppol', [Validators.required]],
    document_reference: ['', [Validators.required]],
    recipient_identifier: ['', [Validators.required]],
    payload: ['', [Validators.required]],
  });

  readonly signForm: FormGroup = this.fb.group({
    document_type: ['invoice' as DocumentTrustType, [Validators.required]],
    document_id: ['', [Validators.required]],
  });

  readonly preserveForm: FormGroup = this.fb.group({
    document_type: ['invoice' as DocumentTrustType, [Validators.required]],
    document_id: ['', [Validators.required]],
  });

  readonly settingsForm: FormGroup = this.fb.group({
    driver: ['local', [Validators.required]],
    certificate: [''],
    private_key: [''],
    passphrase: [''],
  });

  ngOnInit(): void {
    this.loadNetworks();
    this.loadTransmissions();
    this.loadSignatures();
    this.loadPreservationRecords();
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
    this.loading.set(true);
    this.api
      .getTransmissions({
        network: this.filterNetwork() || undefined,
        status: this.filterStatus() || undefined,
        document_reference: this.filterRef() || undefined,
        per_page: 50,
      })
      .subscribe({
        next: (res) => {
          this.transmissions.set(res.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('DOCUMENT_TRUST.TRANSMISSIONS_LOAD_ERROR'));
        },
      });
  }

  onFilterChange(): void {
    this.loadTransmissions();
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
    this.loading.set(true);
    this.api.getSignatures(docId).subscribe({
      next: (res) => {
        this.signatures.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.signatures.set([]);
      },
    });
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
    this.loading.set(true);
    this.api.getPreservationRecords(docId).subscribe({
      next: (res) => {
        this.preservationRecords.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.preservationRecords.set([]);
      },
    });
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
