import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  BillingApiService,
  I18nService,
  InvoiceApprovalMatrix,
  InvoiceApprovalMatrixPayload,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DECIMAL_PATTERN } from '../../cycle/shared/document-lines-editor.component';
import { apiErrorText } from '../../cycle/shared/sales-api-helpers';

const APPROVER_ROLES = ['owner', 'admin', 'accountant', 'sales_manager', 'sales'];

/** Approval matrices of sales invoices: amount tiers approved by a role or a user. */
@Component({
  selector: 'app-invoice-approvals',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './invoice-approvals.component.html',
  styleUrl: '../../cycle/shared/cycle-page.scss',
})
export class InvoiceApprovalsComponent implements OnInit {
  private readonly api = inject(BillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);
  private readonly authStore = inject(AuthStore);
  protected readonly canWrite = computed(
    () => this.permissions.canWrite('invoicing') && ['owner', 'admin', 'accountant'].some((r) => this.authStore.activeRoles().includes(r)),
  );

  protected readonly roles = APPROVER_ROLES;
  protected readonly matrices = signal<InvoiceApprovalMatrix[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly tiers: FormArray = this.fb.array([]);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    cost_center_id: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getApprovalMatrices().subscribe({
      next: (res) => {
        this.matrices.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.form.reset({ name: '', cost_center_id: '' });
    this.tiers.clear();
    this.addTier();
    this.modalOpen.set(true);
  }

  protected addTier(): void {
    this.tiers.push(
      this.fb.group({
        tier_level: [this.tiers.length + 1, [Validators.required, Validators.min(1)]],
        approver_type: ['role', Validators.required],
        approver_value: ['accountant', Validators.required],
        threshold_min: ['', [Validators.pattern(DECIMAL_PATTERN)]],
        threshold_max: ['', [Validators.pattern(DECIMAL_PATTERN)]],
      }),
    );
  }

  protected removeTier(index: number): void {
    if (this.tiers.length > 1) {
      this.tiers.removeAt(index);
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.tiers.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: InvoiceApprovalMatrixPayload = {
      name: v.name,
      cost_center_id: v.cost_center_id || null,
      tiers: (this.tiers.getRawValue() as Record<string, string | number>[]).map((t) => ({
        tier_level: Number(t['tier_level']),
        approver_type: t['approver_type'] as 'role' | 'user',
        approver_value: String(t['approver_value']),
        threshold_min: t['threshold_min'] ? String(t['threshold_min']) : null,
        threshold_max: t['threshold_max'] ? String(t['threshold_max']) : null,
      })),
    };
    this.saving.set(true);
    this.api.createApprovalMatrix(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('SC.COMMON.SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(err));
      },
    });
  }

  protected remove(matrix: InvoiceApprovalMatrix): void {
    this.api.deleteApprovalMatrix(matrix.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SC.COMMON.DELETED'));
        this.load();
      },
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }
}
