import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  DmsAiSettingsResource,
  DmsApiService,
  DmsAuditEntry,
  DmsDocumentParams,
  DmsDocumentResource,
  DmsDocumentStatus,
  DmsDocumentVersionResource,
  DmsExtractionResource,
  DmsFolderResource,
  DmsLinkDocumentRequest,
  DmsPlaceLegalHoldRequest,
  DmsResolvedLink,
  DmsRetentionPolicyResource,
  DmsStoreDocumentRequest,
  DmsStoreFolderRequest,
  DmsStoreRetentionPolicyRequest,
  DmsStoreTagRequest,
  DmsTagResource,
  DmsUpdateAiSettingRequest,
  I18nService,
  serverErrorMessage,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

/** File extensions the API accepts for an upload (`mimes:` of the DMS requests). */
const DMS_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'xml', 'zip', 'eml', 'msg'];

/** API `max:25600` (kilobytes) on an uploaded file. */
const DMS_MAX_FILE_BYTES = 25600 * 1024;

/** Records a document can be linked to: the aliases of the API link registry. */
const DMS_LINK_TARGET_TYPES = [
  'contact',
  'invoice',
  'quote',
  'sales_order',
  'delivery_note',
  'journal_entry',
  'project',
  'asset',
  'service_contract',
  'supplier_contract',
  'supplier',
  'purchase_requisition',
] as const;

@Component({
  selector: 'app-dms',
  styleUrl: './dms.component.scss',
  imports: [
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzFormModule,
    NzModalModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './dms.component.html',
})
export class DmsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dmsApi = inject(DmsApiService);
  private readonly message = inject(NzMessageService);
  protected readonly authStore = inject(AuthStore);

  // Active tab index (0: Documents, 1: Folders, 2: Retention, 3: AI & Tags)
  protected selectedTabIndex = signal<number>(0);

  // --- TAB 1: DOCUMENTS ---
  protected readonly documents = signal<DmsDocumentResource[]>([]);
  protected readonly documentsLoading = signal<boolean>(false);
  protected readonly documentsTotal = signal<number>(0);
  protected readonly documentsPageIndex = signal<number>(1);
  protected readonly documentsPageSize = signal<number>(10);
  protected readonly searchTitle = signal<string>('');
  protected readonly selectedFolderId = signal<string>('');
  protected readonly selectedDocType = signal<string>('');
  protected readonly selectedStatus = signal<DmsDocumentStatus | ''>('');

  // Create Document Modal
  protected createDocModalVisible = signal<boolean>(false);
  protected createDocSubmitting = signal<boolean>(false);
  protected readonly docForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    folder_id: ['', [uuidFormat]],
    document_type: ['Invoice', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(5000)]],
    comment: ['', [Validators.maxLength(500)]],
  });
  protected readonly docFile = signal<File | null>(null);
  protected readonly docFileError = signal<string>('');
  protected readonly acceptedFileTypes = DMS_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',');

  // Check-Out Modal
  protected checkOutModalVisible = signal<boolean>(false);
  protected checkOutDoc = signal<DmsDocumentResource | null>(null);
  protected checkOutNote = signal<string>('');
  protected checkOutSubmitting = signal<boolean>(false);

  // Check-In Modal
  protected checkInModalVisible = signal<boolean>(false);
  protected checkInDoc = signal<DmsDocumentResource | null>(null);
  protected checkInFile = signal<File | null>(null);
  protected checkInFileError = signal<string>('');
  protected checkInComment = signal<string>('');
  protected checkInSubmitting = signal<boolean>(false);

  // Legal Hold Modal
  protected legalHoldModalVisible = signal<boolean>(false);
  protected legalHoldDoc = signal<DmsDocumentResource | null>(null);
  protected legalHoldReason = signal<string>('');
  protected legalHoldSubmitting = signal<boolean>(false);

  // Detail Drawer
  protected drawerVisible = signal<boolean>(false);
  protected selectedDocument = signal<DmsDocumentResource | null>(null);
  protected docVersions = signal<DmsDocumentVersionResource[]>([]);
  protected docLinks = signal<DmsResolvedLink[]>([]);
  protected docExtractions = signal<DmsExtractionResource[]>([]);
  protected docAuditTrail = signal<DmsAuditEntry[]>([]);
  protected drawerLoading = signal<boolean>(false);

  // Add Link Modal inside Drawer
  protected linkModalVisible = signal<boolean>(false);
  protected readonly linkForm = this.fb.group({
    linkable_type: ['invoice', [Validators.required]],
    linkable_id: ['', [Validators.required, uuidFormat]],
  });
  protected readonly linkTargetTypes = DMS_LINK_TARGET_TYPES;

  // --- TAB 2: FOLDERS ---
  protected readonly folders = signal<DmsFolderResource[]>([]);
  protected readonly foldersLoading = signal<boolean>(false);
  protected createFolderModalVisible = signal<boolean>(false);
  protected folderSubmitting = signal<boolean>(false);
  protected readonly folderForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    parent_id: ['', [uuidFormat]],
    access_roles: [['admin', 'accountant']],
  });

  // --- TAB 3: RETENTION POLICIES ---
  protected readonly retentionPolicies = signal<DmsRetentionPolicyResource[]>([]);
  protected readonly retentionLoading = signal<boolean>(false);
  protected createPolicyModalVisible = signal<boolean>(false);
  protected policySubmitting = signal<boolean>(false);
  protected readonly policyForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    document_type: ['Invoice'],
    retention_months: [120, [Validators.required, Validators.min(1), Validators.max(1200)]],
    action: ['archive' as const, [Validators.required]],
    is_active: [true],
  });

  // --- TAB 4: TAGS & AI SETTINGS ---
  protected readonly tags = signal<DmsTagResource[]>([]);
  protected readonly tagsLoading = signal<boolean>(false);
  protected readonly aiSettings = signal<DmsAiSettingsResource>({
    is_ocr_enabled: true,
    min_confidence: 85,
    auto_tagging: true,
  });
  protected readonly aiLoading = signal<boolean>(false);
  protected createTagModalVisible = signal<boolean>(false);
  protected tagSubmitting = signal<boolean>(false);
  protected readonly tagForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    color: ['#1890ff'],
  });

  protected errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    if (key) {
      return this.i18n.translate(key);
    }
    return '';
  }

  ngOnInit(): void {
    this.loadFolders();
    this.loadDocuments();
  }

  protected onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    if (index === 0) {
      this.loadDocuments();
    } else if (index === 1) {
      this.loadFolders();
    } else if (index === 2) {
      this.loadRetentionPolicies();
    } else if (index === 3) {
      this.loadTags();
      this.loadAiSettings();
    }
  }

  // --- DOCUMENTS LOGIC ---
  protected loadDocuments(): void {
    this.documentsLoading.set(true);
    const params: DmsDocumentParams = {
      folder_id: this.selectedFolderId() || undefined,
      document_type: this.selectedDocType() || undefined,
      status: (this.selectedStatus() || undefined) as DmsDocumentStatus | undefined,
      search: this.searchTitle() || undefined,
      page: this.documentsPageIndex(),
      per_page: this.documentsPageSize(),
    };

    this.dmsApi.getDocuments(params).subscribe({
      next: (res) => {
        this.documents.set(res.data);
        this.documentsTotal.set(res.meta?.total ?? res.data.length);
        this.documentsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NEL_CARICAMENTO_DEI_DOCUMENTI_DMS'));
        this.documentsLoading.set(false);
      },
    });
  }

  protected onDocumentsTableQueryChange(params: NzTableQueryParams): void {
    this.documentsPageIndex.set(params.pageIndex);
    this.documentsPageSize.set(params.pageSize);
    this.loadDocuments();
  }

  protected openCreateDocModal(): void {
    this.docForm.reset({
      title: '',
      folder_id: this.selectedFolderId() || '',
      document_type: 'Invoice',
      description: '',
      comment: '',
    });
    this.docFile.set(null);
    this.docFileError.set('');
    this.createDocModalVisible.set(true);
  }

  protected onDocFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.docFile.set(file);
    this.docFileError.set(this.fileErrorKey(file, true));
  }

  protected onCheckInFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.checkInFile.set(file);
    this.checkInFileError.set(this.fileErrorKey(file, false));
  }

  /** Translation key of the problem of a file picked for upload (API: `file|max:25600|mimes:...`), '' when it is fine. */
  private fileErrorKey(file: File | null, required: boolean): string {
    if (!file) {
      return required ? 'COMMON.VALIDATION.REQUIRED' : '';
    }
    if (file.size > DMS_MAX_FILE_BYTES) {
      return 'DMS.ERR_FILE_TOO_LARGE';
    }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return DMS_FILE_EXTENSIONS.includes(extension) ? '' : 'DMS.ERR_FILE_TYPE';
  }

  protected submitCreateDoc(): void {
    const fileError = this.fileErrorKey(this.docFile(), true);
    this.docFileError.set(fileError);
    if (this.docForm.invalid || fileError) {
      this.docForm.markAllAsTouched();
      return;
    }
    const file = this.docFile() as File;

    const val = this.docForm.getRawValue();
    const payload: DmsStoreDocumentRequest = {
      title: val.title,
      folder_id: val.folder_id || undefined,
      document_type: val.document_type,
      description: val.description || undefined,
      comment: val.comment || undefined,
      file,
    };

    this.createDocSubmitting.set(true);
    this.dmsApi.createDocument(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_DOCUMENTO_ARCHIVIATO_CON_SUCCESSO'));
        this.createDocModalVisible.set(false);
        this.createDocSubmitting.set(false);
        this.loadDocuments();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_L_ARCHIVIAZIONE_DEL_DOCUMENTO'));
        this.createDocSubmitting.set(false);
      },
    });
  }

  protected deleteDocument(doc: DmsDocumentResource): void {
    if (doc.legal_hold) {
      this.message.warning(this.translate.instant('DMS.MSG_IMPOSSIBILE_ELIMINARE_UN_DOCUMENTO_PROTETTO_DA'));
      return;
    }

    this.dmsApi.deleteDocument(doc.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_DOCUMENTO_ELIMINATO'));
        this.loadDocuments();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_L_ELIMINAZIONE'));
      },
    });
  }

  // --- CHECK-OUT / CHECK-IN ---
  protected openCheckOutModal(doc: DmsDocumentResource): void {
    this.checkOutDoc.set(doc);
    this.checkOutNote.set('');
    this.checkOutModalVisible.set(true);
  }

  protected submitCheckOut(): void {
    const doc = this.checkOutDoc();
    if (!doc) return;

    this.checkOutSubmitting.set(true);
    this.dmsApi.checkOutDocument(doc.id, { note: this.checkOutNote() || undefined }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_DOCUMENTO_ESTRATTO_IN_MODIFICA_CHECK_OUT'));
        this.checkOutModalVisible.set(false);
        this.checkOutSubmitting.set(false);
        this.loadDocuments();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_IL_CHECK_OUT'));
        this.checkOutSubmitting.set(false);
      },
    });
  }

  protected openCheckInModal(doc: DmsDocumentResource): void {
    this.checkInDoc.set(doc);
    this.checkInFile.set(null);
    this.checkInFileError.set('');
    this.checkInComment.set('');
    this.checkInModalVisible.set(true);
  }

  protected submitCheckIn(): void {
    const doc = this.checkInDoc();
    if (!doc) return;
    const fileError = this.fileErrorKey(this.checkInFile(), false);
    this.checkInFileError.set(fileError);
    if (fileError) return;

    this.checkInSubmitting.set(true);
    this.dmsApi
      .checkInDocument(doc.id, { file: this.checkInFile(), comment: this.checkInComment() || undefined })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('DMS.MSG_NUOVA_VERSIONE_CARICATA_CHECK_IN_COMPLETATO'));
          this.checkInModalVisible.set(false);
          this.checkInSubmitting.set(false);
          this.loadDocuments();
        },
        error: () => {
          this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_IL_CHECK_IN'));
          this.checkInSubmitting.set(false);
        },
      });
  }

  // --- LEGAL HOLD ---
  protected openLegalHoldModal(doc: DmsDocumentResource): void {
    this.legalHoldDoc.set(doc);
    this.legalHoldReason.set('');
    this.legalHoldModalVisible.set(true);
  }

  protected submitLegalHold(): void {
    const doc = this.legalHoldDoc();
    if (!doc) return;

    if (!this.legalHoldReason().trim()) {
      this.message.warning(this.translate.instant('DMS.MSG_LA_MOTIVAZIONE_DEL_BLOCCO_CONSERVATIVO_E'));
      return;
    }

    const payload: DmsPlaceLegalHoldRequest = { reason: this.legalHoldReason().trim() };
    this.legalHoldSubmitting.set(true);
    this.dmsApi.placeLegalHold(doc.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_BLOCCO_PROBATORIO_LEGAL_HOLD_APPLICATO_CON'));
        this.legalHoldModalVisible.set(false);
        this.legalHoldSubmitting.set(false);
        this.loadDocuments();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_L_APPLICAZIONE_DEL_BLOCCO'));
        this.legalHoldSubmitting.set(false);
      },
    });
  }

  protected releaseLegalHold(doc: DmsDocumentResource): void {
    this.dmsApi.releaseLegalHold(doc.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_BLOCCO_PROBATORIO_RIMOSSO'));
        this.loadDocuments();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NELLA_RIMOZIONE_DEL_LEGAL_HOLD'));
      },
    });
  }

  // --- DETAIL DRAWER & VERIFY ---
  protected openDrawer(doc: DmsDocumentResource): void {
    this.selectedDocument.set(doc);
    this.drawerVisible.set(true);
    this.drawerLoading.set(true);

    this.dmsApi.getDocumentVersions(doc.id).subscribe({
      next: (res) => this.docVersions.set(res.data),
      error: () => this.docVersions.set([]),
    });

    this.dmsApi.getDocumentLinks(doc.id).subscribe({
      next: (res) => this.docLinks.set(res.data),
      error: () => this.docLinks.set([]),
    });

    this.dmsApi.getDocumentExtractions(doc.id).subscribe({
      next: (res) => this.docExtractions.set(res.data),
      error: () => this.docExtractions.set([]),
    });

    this.dmsApi.getDocumentAuditTrail(doc.id).subscribe({
      next: (res) => {
        this.docAuditTrail.set(res.data);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.docAuditTrail.set([]);
        this.drawerLoading.set(false);
      },
    });
  }

  protected verifySha256(version: DmsDocumentVersionResource): void {
    const doc = this.selectedDocument();
    if (!doc) return;

    this.dmsApi.verifyVersion(doc.id, version.id).subscribe({
      next: (res) => {
        if (res.data.is_valid) {
          this.message.success(this.translate.instant('DMS.MSG_INTEGRITA_SHA_256_VERIFICATA', { value: version.sha256.slice(0, 16) }));
        } else {
          this.message.error(this.translate.instant('DMS.MSG_ATTENZIONE_IMPRONTA_HASH_NON_CORRISPONDENTE'));
        }
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_LA_VERIFICA_CRITTOGRAFICA'));
      },
    });
  }

  protected confirmExtraction(extr: DmsExtractionResource): void {
    this.dmsApi.confirmExtraction(extr.id, { confirmed_value: extr.extracted_value }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_DATO_CONFERMATO', { field_name: extr.field_name }));
        extr.status = 'confirmed';
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_ERRORE_NELLA_CONFERMA_DEL_DATO')),
    });
  }

  protected rejectExtraction(extr: DmsExtractionResource): void {
    this.dmsApi.rejectExtraction(extr.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_DATO_SCARTATO', { field_name: extr.field_name }));
        extr.status = 'rejected';
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_ERRORE_NEL_RIFIUTO_DEL_DATO')),
    });
  }

  protected openLinkModal(): void {
    this.linkForm.reset({
      linkable_type: 'invoice',
      linkable_id: '',
    });
    this.linkModalVisible.set(true);
  }

  protected submitLink(): void {
    const doc = this.selectedDocument();
    if (!doc) return;
    if (this.linkForm.invalid) {
      this.linkForm.markAllAsTouched();
      return;
    }

    const raw = this.linkForm.getRawValue();
    const payload: DmsLinkDocumentRequest = {
      linkable_type: raw.linkable_type,
      linkable_id: raw.linkable_id,
    };

    this.dmsApi.linkDocument(doc.id, payload).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('DMS.MSG_DOCUMENTO_COLLEGATO_ALL_ENTITA_GESTIONALE'));
        this.docLinks.update((list) => [...list, res.data]);
        this.linkModalVisible.set(false);
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_IL_COLLEGAMENTO')),
    });
  }

  protected removeLink(link: DmsResolvedLink): void {
    const doc = this.selectedDocument();
    if (!doc) return;

    this.dmsApi.removeLink(doc.id, link.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_COLLEGAMENTO_RIMOSSO'));
        this.docLinks.update((list) => list.filter((l) => l.id !== link.id));
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_IMPOSSIBILE_RIMUOVERE_IL_COLLEGAMENTO')),
    });
  }

  // --- FOLDERS LOGIC ---
  protected loadFolders(): void {
    this.foldersLoading.set(true);
    this.dmsApi.getFolders().subscribe({
      next: (res) => {
        this.folders.set(res.data);
        this.foldersLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_CARTELLE'));
        this.foldersLoading.set(false);
      },
    });
  }

  protected openCreateFolderModal(): void {
    this.folderForm.reset({
      name: '',
      parent_id: '',
      access_roles: ['admin', 'accountant'],
    });
    this.createFolderModalVisible.set(true);
  }

  protected submitCreateFolder(): void {
    if (this.folderForm.invalid) {
      this.folderForm.markAllAsTouched();
      return;
    }

    const payload: DmsStoreFolderRequest = this.folderForm.getRawValue();
    this.folderSubmitting.set(true);
    this.dmsApi.createFolder(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_CARTELLA_CREATA'));
        this.createFolderModalVisible.set(false);
        this.folderSubmitting.set(false);
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NELLA_CREAZIONE_DELLA_CARTELLA'));
        this.folderSubmitting.set(false);
      },
    });
  }

  protected deleteFolder(folder: DmsFolderResource): void {
    this.dmsApi.deleteFolder(folder.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_CARTELLA_ELIMINATA'));
        this.loadFolders();
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_IMPOSSIBILE_ELIMINARE_LA_CARTELLA')),
    });
  }

  // --- RETENTION POLICIES LOGIC ---
  protected loadRetentionPolicies(): void {
    this.retentionLoading.set(true);
    this.dmsApi.getRetentionPolicies().subscribe({
      next: (res) => {
        this.retentionPolicies.set(res.data);
        this.retentionLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_POLICY_DI'));
        this.retentionLoading.set(false);
      },
    });
  }

  protected openCreatePolicyModal(): void {
    this.policyForm.reset({
      name: '',
      document_type: 'Invoice',
      retention_months: 120,
      action: 'archive',
      is_active: true,
    });
    this.createPolicyModalVisible.set(true);
  }

  protected submitCreatePolicy(): void {
    if (this.policyForm.invalid) {
      this.policyForm.markAllAsTouched();
      return;
    }

    const payload: DmsStoreRetentionPolicyRequest = this.policyForm.getRawValue();
    this.policySubmitting.set(true);
    this.dmsApi.createRetentionPolicy(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_POLICY_DI_CONSERVAZIONE_REGISTRATA'));
        this.createPolicyModalVisible.set(false);
        this.policySubmitting.set(false);
        this.loadRetentionPolicies();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_LA_REGISTRAZIONE_DELLA_POLICY'));
        this.policySubmitting.set(false);
      },
    });
  }

  protected deleteRetentionPolicy(policy: DmsRetentionPolicyResource): void {
    this.dmsApi.deleteRetentionPolicy(policy.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_POLICY_ELIMINATA'));
        this.loadRetentionPolicies();
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_IMPOSSIBILE_ELIMINARE_LA_POLICY')),
    });
  }

  // --- TAGS & AI SETTINGS LOGIC ---
  protected loadTags(): void {
    this.tagsLoading.set(true);
    this.dmsApi.getTags().subscribe({
      next: (res) => {
        this.tags.set(res.data);
        this.tagsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NEL_CARICAMENTO_DEI_TAG'));
        this.tagsLoading.set(false);
      },
    });
  }

  protected openCreateTagModal(): void {
    this.tagForm.reset({ name: '', color: '#1890ff' });
    this.createTagModalVisible.set(true);
  }

  protected submitCreateTag(): void {
    if (this.tagForm.invalid) {
      this.tagForm.markAllAsTouched();
      return;
    }

    const payload: DmsStoreTagRequest = this.tagForm.getRawValue();
    this.tagSubmitting.set(true);
    this.dmsApi.createTag(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS.MSG_TAG_CREATO_CON_SUCCESSO'));
        this.createTagModalVisible.set(false);
        this.tagSubmitting.set(false);
        this.loadTags();
      },
      error: () => {
        this.message.error(this.translate.instant('DMS.MSG_ERRORE_NELLA_CREAZIONE_DEL_TAG'));
        this.tagSubmitting.set(false);
      },
    });
  }

  protected deleteTag(tag: DmsTagResource): void {
    this.dmsApi.deleteTag(tag.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('DMS.MSG_TAG_ELIMINATO'));
        this.loadTags();
      },
      error: () => this.message.error(this.translate.instant('DMS.MSG_IMPOSSIBILE_ELIMINARE_IL_TAG')),
    });
  }

  protected loadAiSettings(): void {
    this.aiLoading.set(true);
    this.dmsApi.getAiSettings().subscribe({
      next: (res) => {
        this.aiSettings.set(res.data);
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiLoading.set(false);
      },
    });
  }

  protected saveAiSettings(): void {
    const payload: DmsUpdateAiSettingRequest = this.aiSettings();
    this.dmsApi.updateAiSettings(payload).subscribe({
      next: () => this.message.success(this.translate.instant('DMS.MSG_CONFIGURAZIONE_AI_OCR_SALVATA')),
      error: () => this.message.error(this.translate.instant('DMS.MSG_ERRORE_DURANTE_IL_SALVATAGGIO_DEI_PARAMETRI')),
    });
  }

  // --- HELPERS ---
  protected getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  }
}
