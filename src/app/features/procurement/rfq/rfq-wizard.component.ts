import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import { RfqApiService } from '@data-access/procurement/rfq-api.service';
import {
  ApprovedRequisitionOption,
  CreateRfqFromRequisitionsPayload,
  CreateRfqLinePayload,
  CreateRfqPayload,
  QualifiedSupplierOption,
  RfqAttachment,
  RfqSummary,
} from '@domain/procurement/rfq.models';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { firstValueFrom } from 'rxjs';

interface WizardLineDraft {
  localId: string;
  source_requisition_line_id: string | null;
  item_id: string | null;
  custom_item_code: string;
  description: string;
  technical_specifications: string;
  quantity: number;
  unit_of_measure: string;
  target_unit_price: number | null;
  requested_delivery_date: string;
}

interface PendingAttachmentItem {
  localId: string;
  file: File;
  isVisibleToSuppliers: boolean;
}

interface PrImportSelection {
  requisitionIds: string[];
  lineIds: string[];
  consolidate: boolean;
}

@Component({
  selector: 'app-rfq-wizard',
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSliderModule,
    NzStepsModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    NzUploadModule,
  ],
  templateUrl: './rfq-wizard.component.html',
  styleUrl: './rfq-wizard.component.scss',
})
export class RfqWizardComponent implements OnInit {
  private readonly api = inject(RfqApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  readonly rfqId = signal<string | null>(null);
  readonly currentStep = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Step 1: General & Evaluation Criteria
  readonly title = signal<string>('');
  readonly description = signal<string>('');
  readonly currencyCode = signal<string>('EUR');
  readonly incoterms = signal<string>('DDP');
  readonly submissionDeadline = signal<string>(this.defaultDeadlineLocal());
  readonly expectedDeliveryDate = signal<string>('');
  readonly sealedBidding = signal<boolean>(false);
  readonly priceWeight = signal<number>(60);
  readonly leadTimeWeight = signal<number>(25);
  readonly supplierRatingWeight = signal<number>(15);

  readonly weightsSum = computed(
    () => this.priceWeight() + this.leadTimeWeight() + this.supplierRatingWeight(),
  );
  readonly weightsValid = computed(() => this.weightsSum() === 100);

  // Step 2: Line Items & PR Consolidation
  readonly lines = signal<WizardLineDraft[]>([this.createEmptyLine()]);
  readonly prDrawerOpen = signal<boolean>(false);
  readonly prLoading = signal<boolean>(false);
  readonly approvedRequisitions = signal<ApprovedRequisitionOption[]>([]);
  readonly selectedPrLineIds = signal<string[]>([]);
  readonly consolidateMatchingItems = signal<boolean>(true);
  readonly activePrImport = signal<PrImportSelection | null>(null);

  // Step 3: Technical Attachments
  readonly persistedAttachments = signal<RfqAttachment[]>([]);
  readonly pendingFiles = signal<PendingAttachmentItem[]>([]);

  // Step 4: Qualified Suppliers
  readonly suppliers = signal<QualifiedSupplierOption[]>([]);
  readonly suppliersLoading = signal<boolean>(false);
  readonly supplierSearch = signal<string>('');
  readonly supplierCategoryFilter = signal<string | null>(null);
  readonly selectedSupplierIds = signal<string[]>([]);

  readonly currencies = ['EUR', 'CHF', 'USD', 'GBP'];
  readonly incotermsOptions = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FOB', 'CIF'];

  readonly supplierCategories = computed(() => {
    const map = new Map<string, string>();
    for (const supplier of this.suppliers()) {
      if (supplier.category) {
        map.set(supplier.category.id, supplier.category.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  });

  readonly filteredSuppliers = computed(() => {
    const query = this.supplierSearch().trim().toLowerCase();
    const categoryId = this.supplierCategoryFilter();
    return this.suppliers().filter((supplier) => {
      if (categoryId && supplier.category?.id !== categoryId) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        supplier.company_name.toLowerCase().includes(query) ||
        supplier.supplier_code.toLowerCase().includes(query) ||
        (supplier.vat_number ?? '').toLowerCase().includes(query)
      );
    });
  });

  readonly canSubmitWizard = computed(() => {
    const hasTitle = this.title().trim().length > 0;
    const hasDeadline = this.submissionDeadline().trim().length > 0;
    const validLines =
      this.lines().length > 0 &&
      this.lines().every((line) => line.description.trim().length > 0 && line.quantity > 0);
    const hasSuppliers = this.selectedSupplierIds().length > 0;
    return hasTitle && hasDeadline && this.weightsValid() && validLines && hasSuppliers;
  });

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id');
    this.loadQualifiedSuppliers();

    if (routeId) {
      this.rfqId.set(routeId);
      this.loadExistingRfq(routeId);
    }
  }

  prevStep(): void {
    this.currentStep.update((step) => Math.max(0, step - 1));
  }

  nextStep(): void {
    this.currentStep.update((step) => Math.min(3, step + 1));
  }

  goToStep(step: number): void {
    this.currentStep.set(step);
  }

  addLine(): void {
    this.activePrImport.set(null);
    this.lines.update((list) => [...list, this.createEmptyLine()]);
  }

  removeLine(localId: string): void {
    this.activePrImport.set(null);
    this.lines.update((list) => {
      const next = list.filter((item) => item.localId !== localId);
      return next.length > 0 ? next : [this.createEmptyLine()];
    });
  }

  updateLine<K extends keyof WizardLineDraft>(localId: string, field: K, value: WizardLineDraft[K]): void {
    this.activePrImport.set(null);
    this.lines.update((list) =>
      list.map((line) => (line.localId === localId ? { ...line, [field]: value } : line)),
    );
  }

  openPrDrawer(): void {
    this.prDrawerOpen.set(true);
    this.prLoading.set(true);
    this.api.listApprovedRequisitions().subscribe({
      next: (res) => {
        this.approvedRequisitions.set(res.data ?? []);
        this.prLoading.set(false);
      },
      error: () => {
        this.prLoading.set(false);
      },
    });
  }

  closePrDrawer(): void {
    this.prDrawerOpen.set(false);
  }

  isPrLineSelected(lineId: string): boolean {
    return this.selectedPrLineIds().includes(lineId);
  }

  togglePrLine(lineId: string, checked: boolean): void {
    this.selectedPrLineIds.update((ids) =>
      checked ? Array.from(new Set([...ids, lineId])) : ids.filter((id) => id !== lineId),
    );
  }

  onPrLineCheckboxChange(lineId: string, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.togglePrLine(lineId, !!input?.checked);
  }

  toggleEntireRequisition(req: ApprovedRequisitionOption, checked: boolean): void {
    const reqLineIds = (req.lines ?? []).map((line) => line.id);
    this.selectedPrLineIds.update((ids) => {
      if (checked) {
        return Array.from(new Set([...ids, ...reqLineIds]));
      }
      return ids.filter((id) => !reqLineIds.includes(id));
    });
  }

  importSelectedPrLines(): void {
    const selectedIds = new Set(this.selectedPrLineIds());
    if (selectedIds.size === 0) {
      return;
    }

    const pickedRequisitionIds = new Set<string>();
    const rawDrafts: WizardLineDraft[] = [];

    for (const req of this.approvedRequisitions()) {
      for (const line of req.lines ?? []) {
        if (!selectedIds.has(line.id)) {
          continue;
        }
        pickedRequisitionIds.add(req.id);
        const requested = Number(line.quantity_requested ?? 0);
        const quoted = Number(line.quantity_quoted ?? 0);
        const remaining = Math.max(1, requested - quoted);

        rawDrafts.push({
          localId: this.nextLocalId(),
          source_requisition_line_id: line.id,
          item_id: line.item_id ?? null,
          custom_item_code: '',
          description: line.description,
          technical_specifications: '',
          quantity: Number.isFinite(remaining) && remaining > 0 ? remaining : 1,
          unit_of_measure: line.uom || 'PCS',
          target_unit_price:
            line.estimated_unit_price !== undefined && line.estimated_unit_price !== null
              ? Number(line.estimated_unit_price)
              : null,
          requested_delivery_date: req.required_by_date ?? '',
        });
      }
    }

    let finalDrafts = rawDrafts;
    if (this.consolidateMatchingItems()) {
      const grouped = new Map<string, WizardLineDraft>();
      for (const draft of rawDrafts) {
        const key = draft.item_id
          ? `item:${draft.item_id}`
          : `desc:${draft.description.trim().toLowerCase()}|${draft.unit_of_measure.trim().toUpperCase()}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.quantity += draft.quantity;
        } else {
          grouped.set(key, { ...draft });
        }
      }
      finalDrafts = Array.from(grouped.values());
    }

    const existingMeaningful = this.lines().filter((l) => l.description.trim().length > 0);
    if (existingMeaningful.length === 0 && this.rfqId() === null) {
      this.lines.set(finalDrafts);
      this.activePrImport.set({
        requisitionIds: Array.from(pickedRequisitionIds),
        lineIds: Array.from(selectedIds),
        consolidate: this.consolidateMatchingItems(),
      });
    } else {
      this.lines.set([...existingMeaningful, ...finalDrafts]);
      this.activePrImport.set(null);
    }

    this.closePrDrawer();
  }

  readonly handleBeforeUpload = (file: NzUploadFile): boolean => {
    const rawFile = (file as unknown as { originFileObj?: File }).originFileObj ?? (file as unknown as File);
    if (!(rawFile instanceof File)) {
      return false;
    }

    const currentRfqId = this.rfqId();
    if (currentRfqId) {
      this.api.uploadAttachment(currentRfqId, rawFile, true).subscribe({
        next: (res) => {
          this.persistedAttachments.update((list) => [...list, res.data]);
        },
      });
    } else {
      this.pendingFiles.update((list) => [
        ...list,
        {
          localId: this.nextLocalId(),
          file: rawFile,
          isVisibleToSuppliers: true,
        },
      ]);
    }
    return false;
  };

  togglePersistedAttachmentVisibility(attachment: RfqAttachment, visible: boolean): void {
    const currentRfqId = this.rfqId();
    if (!currentRfqId) {
      return;
    }
    this.api.toggleAttachmentVisibility(currentRfqId, attachment.id, visible).subscribe({
      next: (res) => {
        this.persistedAttachments.update((list) =>
          list.map((item) => (item.id === attachment.id ? res.data : item)),
        );
      },
    });
  }

  deletePersistedAttachment(attachmentId: string): void {
    const currentRfqId = this.rfqId();
    if (!currentRfqId) {
      return;
    }
    this.api.deleteAttachment(currentRfqId, attachmentId).subscribe({
      next: () => {
        this.persistedAttachments.update((list) => list.filter((item) => item.id !== attachmentId));
      },
    });
  }

  togglePendingFileVisibility(localId: string, visible: boolean): void {
    this.pendingFiles.update((list) =>
      list.map((item) => (item.localId === localId ? { ...item, isVisibleToSuppliers: visible } : item)),
    );
  }

  removePendingFile(localId: string): void {
    this.pendingFiles.update((list) => list.filter((item) => item.localId !== localId));
  }

  isSupplierSelected(supplierId: string): boolean {
    return this.selectedSupplierIds().includes(supplierId);
  }

  toggleSupplier(supplierId: string, checked: boolean): void {
    this.selectedSupplierIds.update((ids) =>
      checked ? Array.from(new Set([...ids, supplierId])) : ids.filter((id) => id !== supplierId),
    );
  }

  onSupplierCheckboxChange(supplierId: string, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.toggleSupplier(supplierId, !!input?.checked);
  }

  async saveDraft(): Promise<void> {
    await this.persistRfq(false);
  }

  async publishAndDispatch(): Promise<void> {
    await this.persistRfq(true);
  }

  private async persistRfq(shouldPublish: boolean): Promise<void> {
    if (!this.canSubmitWizard()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const deadlineIso = new Date(this.submissionDeadline()).toISOString();
      const existingId = this.rfqId();
      const prImport = this.activePrImport();

      let savedRfq: RfqSummary;

      if (existingId) {
        const res = await firstValueFrom(this.api.updateRfq(existingId, this.buildStandardPayload(deadlineIso)));
        savedRfq = res.data;
      } else if (prImport && prImport.requisitionIds.length > 0) {
        const prPayload: CreateRfqFromRequisitionsPayload = {
          purchase_requisition_ids: prImport.requisitionIds,
          line_ids: prImport.lineIds,
          title: this.title().trim(),
          description: this.description().trim() || null,
          currency_code: this.currencyCode(),
          incoterms: this.incoterms().trim() || null,
          submission_deadline: deadlineIso,
          expected_delivery_date: this.expectedDeliveryDate() || null,
          sealed_bidding: this.sealedBidding(),
          consolidate_matching_items: prImport.consolidate,
          evaluation_weights: {
            price_weight: this.priceWeight(),
            lead_time_weight: this.leadTimeWeight(),
            supplier_rating_weight: this.supplierRatingWeight(),
          },
          supplier_ids: this.selectedSupplierIds(),
        };
        const res = await firstValueFrom(this.api.createFromRequisitions(prPayload));
        savedRfq = res.data;
      } else {
        const res = await firstValueFrom(this.api.createRfq(this.buildStandardPayload(deadlineIso)));
        savedRfq = res.data;
      }

      this.rfqId.set(savedRfq.id);

      const pending = [...this.pendingFiles()];
      for (const item of pending) {
        const uploaded = await firstValueFrom(
          this.api.uploadAttachment(savedRfq.id, item.file, item.isVisibleToSuppliers),
        );
        this.persistedAttachments.update((list) => [...list, uploaded.data]);
      }
      this.pendingFiles.set([]);

      if (shouldPublish) {
        await firstValueFrom(this.api.publishRfq(savedRfq.id));
        this.message.success(this.i18n.translate('RFQ.PUBLISH_SUCCESS'));
        void this.router.navigate(['/procurement/rfqs', savedRfq.id, 'matrix']);
      } else {
        this.message.success(this.i18n.translate('RFQ.WIZARD.SAVED_DRAFT'));
        void this.router.navigate(['/procurement/rfqs', savedRfq.id, 'edit']);
      }
    } catch (err: unknown) {
      this.error.set(String(err));
    } finally {
      this.saving.set(false);
    }
  }

  private buildStandardPayload(deadlineIso: string): CreateRfqPayload {
    const linePayloads: CreateRfqLinePayload[] = this.lines().map((line) => ({
      source_requisition_line_id: line.source_requisition_line_id,
      item_id: line.item_id,
      custom_item_code: line.custom_item_code.trim() || null,
      description: line.description.trim(),
      technical_specifications: line.technical_specifications.trim() || null,
      quantity: line.quantity,
      unit_of_measure: line.unit_of_measure.trim() || 'PCS',
      target_unit_price: line.target_unit_price,
      requested_delivery_date: line.requested_delivery_date || null,
    }));

    return {
      title: this.title().trim(),
      description: this.description().trim() || null,
      currency_code: this.currencyCode(),
      incoterms: this.incoterms().trim() || null,
      submission_deadline: deadlineIso,
      expected_delivery_date: this.expectedDeliveryDate() || null,
      sealed_bidding: this.sealedBidding(),
      evaluation_weights: {
        price_weight: this.priceWeight(),
        lead_time_weight: this.leadTimeWeight(),
        supplier_rating_weight: this.supplierRatingWeight(),
      },
      supplier_ids: this.selectedSupplierIds(),
      lines: linePayloads,
    };
  }

  private loadExistingRfq(id: string): void {
    this.loading.set(true);
    this.api.getRfq(id).subscribe({
      next: (res) => {
        const rfq = res.data;
        this.title.set(rfq.title);
        this.description.set(rfq.description ?? '');
        this.currencyCode.set(rfq.currency_code || rfq.currency || 'EUR');
        this.incoterms.set(rfq.incoterms ?? '');
        this.submissionDeadline.set(this.toLocalDatetimeInput(rfq.submission_deadline));
        this.expectedDeliveryDate.set(rfq.expected_delivery_date ?? '');
        this.sealedBidding.set(rfq.sealed_bidding);
        this.priceWeight.set(rfq.evaluation_weights?.price_weight ?? 60);
        this.leadTimeWeight.set(rfq.evaluation_weights?.lead_time_weight ?? 25);
        this.supplierRatingWeight.set(rfq.evaluation_weights?.supplier_rating_weight ?? 15);

        if (rfq.lines && rfq.lines.length > 0) {
          this.lines.set(
            rfq.lines.map((line) => ({
              localId: this.nextLocalId(),
              source_requisition_line_id: line.source_requisition_line_id,
              item_id: line.item_id,
              custom_item_code: line.custom_item_code ?? line.internal_sku ?? '',
              description: line.description,
              technical_specifications: line.technical_specifications ?? '',
              quantity: Number(line.quantity),
              unit_of_measure: line.unit_of_measure || line.uom || 'PCS',
              target_unit_price: line.target_unit_price !== null ? Number(line.target_unit_price) : null,
              requested_delivery_date: line.requested_delivery_date ?? '',
            })),
          );
        }

        this.persistedAttachments.set(rfq.attachments ?? []);
        this.selectedSupplierIds.set((rfq.invitations ?? []).map((inv) => inv.supplier_id));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(String(err));
        this.loading.set(false);
      },
    });
  }

  private loadQualifiedSuppliers(): void {
    this.suppliersLoading.set(true);
    this.api.listQualifiedSuppliers().subscribe({
      next: (res) => {
        this.suppliers.set(res.data ?? []);
        this.suppliersLoading.set(false);
      },
      error: () => {
        this.suppliersLoading.set(false);
      },
    });
  }

  private createEmptyLine(): WizardLineDraft {
    return {
      localId: this.nextLocalId(),
      source_requisition_line_id: null,
      item_id: null,
      custom_item_code: '',
      description: '',
      technical_specifications: '',
      quantity: 1,
      unit_of_measure: 'PCS',
      target_unit_price: null,
      requested_delivery_date: '',
    };
  }

  private nextLocalId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private defaultDeadlineLocal(): string {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    date.setHours(17, 0, 0, 0);
    return this.toLocalDatetimeInput(date.toISOString());
  }

  private toLocalDatetimeInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
