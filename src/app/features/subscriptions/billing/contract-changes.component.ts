import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  I18nService,
  PermissionsService,
  ProrationPreview,
  SubscriptionApiService,
  SubscriptionContractResource,
  SubscriptionDunningCase,
  SubscriptionPlanResource,
} from '@core';
import { TranslatePipe } from '@shared';

type ChangeKind = 'upgrade' | 'downgrade' | 'quantity' | 'suspend' | 'collection';

const DECIMAL = /^\d+(\.\d{1,4})?$/;

/** Prorated plan and seat changes, suspension and collection failures of a subscription contract (`/sub/contracts`). */
@Component({
  selector: 'app-contract-changes',
  styleUrl: './subscription-billing.scss',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, NzTableModule, TranslatePipe],
  templateUrl: './contract-changes.component.html',
})
export class ContractChangesComponent implements OnInit {
  private readonly api = inject(SubscriptionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('subscriptions'));

  protected readonly contracts = signal<SubscriptionContractResource[]>([]);
  protected readonly plans = signal<SubscriptionPlanResource[]>([]);
  protected readonly dunning = signal<SubscriptionDunningCase[]>([]);
  protected readonly preview = signal<ProrationPreview | null>(null);
  protected readonly working = signal(false);
  protected readonly kinds: ChangeKind[] = ['upgrade', 'downgrade', 'quantity', 'suspend', 'collection'];

  protected contractId: string | null = null;
  protected kind: ChangeKind = 'upgrade';
  protected newPlanId: string | null = null;
  protected quantity = '';
  protected effectiveDate = '';
  protected reason = '';
  protected resumeOn = '';
  /** Today (YYYY-MM-DD): the API requires resume_on after today (after:today). */
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected invoiceId = '';

  ngOnInit(): void {
    this.api.getContracts({ per_page: 100 }).subscribe({ next: (res) => this.contracts.set(res.data ?? []) });
    this.api.getPlans().subscribe({ next: (res) => this.plans.set(res.data ?? []) });
  }

  protected selectContract(id: string | null): void {
    this.contractId = id;
    this.preview.set(null);
    this.dunning.set([]);
    if (id) {
      this.api.getContractDunning(id).subscribe({ next: (res) => this.dunning.set(res.data ?? []) });
    }
  }

  protected needsPlan(): boolean {
    return this.kind === 'upgrade' || this.kind === 'downgrade';
  }

  protected canPreview(): boolean {
    return !!this.contractId && (this.needsPlan() ? !!this.newPlanId : this.kind === 'quantity' && DECIMAL.test(this.quantity));
  }

  protected valid(): boolean {
    if (!this.contractId) {
      return false;
    }
    switch (this.kind) {
      case 'upgrade':
      case 'downgrade':
        return !!this.newPlanId && (!this.quantity || DECIMAL.test(this.quantity));
      case 'quantity':
        return DECIMAL.test(this.quantity);
      case 'collection':
        return this.invoiceId.trim().length > 0;
      case 'suspend':
        return !this.resumeOn || this.resumeOn > this.today;
      default:
        return true;
    }
  }

  protected previewProration(): void {
    if (!this.contractId || !this.canPreview()) {
      return;
    }
    this.api
      .getProrationPreview(this.contractId, {
        new_plan_id: this.needsPlan() ? this.newPlanId : null,
        quantity: this.quantity || null,
        effective_date: this.effectiveDate || null,
      })
      .subscribe({ next: (res) => this.preview.set(res.data) });
  }

  protected previewJson(): string {
    return JSON.stringify(this.preview() ?? {}, null, 2);
  }

  protected apply(): void {
    const id = this.contractId;
    if (!id || !this.valid()) {
      return;
    }
    const effective = this.effectiveDate || null;
    const request =
      this.kind === 'upgrade'
        ? this.api.upgradeContract(id, {
            new_plan_id: this.newPlanId as string,
            quantity: this.quantity || null,
            effective_date: effective,
            change_reason: this.reason || null,
          })
        : this.kind === 'downgrade'
          ? this.api.downgradeContract(id, {
              new_plan_id: this.newPlanId as string,
              quantity: this.quantity || null,
              effective_date: effective,
              change_reason: this.reason || null,
            })
          : this.kind === 'quantity'
            ? this.api.changeContractQuantity(id, { quantity: this.quantity, effective_date: effective, reason: this.reason || null })
            : this.kind === 'suspend'
              ? this.api.suspendContract(id, { reason: this.reason || null, resume_on: this.resumeOn || null })
              : this.api.recordCollectionFailure(id, { invoice_id: this.invoiceId.trim(), reason: this.reason || null });
    this.working.set(true);
    request.subscribe({
      next: () => {
        this.working.set(false);
        this.message.success(this.i18n.translate('SUBX.CHANGES.APPLIED'));
        this.selectContract(id);
        this.api.getContracts({ per_page: 100 }).subscribe({ next: (res) => this.contracts.set(res.data ?? []) });
      },
      error: () => this.working.set(false),
    });
  }
}
