import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { EquipmentComponent, RmaLabel, WarrantyRmaApiService } from '@core';
import { CurrencyFormatPipe, TranslatePipe } from '@shared';
import { ActionResult, RmaNotifier, runRequest } from '../../state/action-result';
import { RmaBoardStore } from '../../state/rma-board.store';
import { RmaDetailStore } from '../../state/rma-detail.store';
import {
  allowedRmaActions,
  canIssueLoaner,
  estimateApprovalTag,
  isLoanerOverdue,
  loanerStatusTag,
  RmaAction,
  rmaStatusLabelKey,
  rmaStatusTag,
  toAmount,
  vendorClaimTag,
  warrantyStatusTag,
} from '../../utils/rma-status';
import { CompleteRepairDialogComponent } from '../rma-actions/complete-repair-dialog.component';
import { DiagnosisDialogComponent } from '../rma-actions/diagnosis-dialog.component';
import { IssueLoanerDialogComponent } from '../rma-actions/issue-loaner-dialog.component';
import {
  NoteActionDialogComponent,
  NoteActionKind,
} from '../rma-actions/note-action-dialog.component';
import { ReceiveDialogComponent } from '../rma-actions/receive-dialog.component';
import { ReturnDialogComponent } from '../rma-actions/return-dialog.component';
import { RmaLabelDialogComponent } from '../shared/rma-label-dialog.component';
import { StatusTagComponent } from '../shared/status-tag.component';
import { TokenRevealDialogComponent } from '../shared/token-reveal-dialog.component';

type DialogAction =
  'receive' | 'diagnosis' | 'complete_repair' | 'return' | 'issue_loaner' | NoteActionKind;

/** RMA detail with status-dependent actions. Every completed or rejected (409) action reloads the bench. */
@Component({
  selector: 'app-rma-detail-drawer',
  imports: [
    DatePipe,
    RouterLink,
    NzDrawerModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTimelineModule,
    TranslatePipe,
    CurrencyFormatPipe,
    StatusTagComponent,
    TokenRevealDialogComponent,
    RmaLabelDialogComponent,
    ReceiveDialogComponent,
    DiagnosisDialogComponent,
    CompleteRepairDialogComponent,
    ReturnDialogComponent,
    NoteActionDialogComponent,
    IssueLoanerDialogComponent,
  ],
  templateUrl: './rma-detail-drawer.component.html',
  styleUrl: './rma-detail-drawer.component.scss',
})
export class RmaDetailDrawerComponent {
  readonly store = inject(RmaDetailStore);
  private readonly board = inject(RmaBoardStore, { optional: true });
  private readonly api = inject(WarrantyRmaApiService);
  private readonly notifier = inject(RmaNotifier);

  readonly open = model(false);
  readonly rmaId = input<string | null>(null);
  /** Action requested from a board card: its dialog opens once the RMA is loaded. */
  readonly initialAction = input<RmaAction | null>(null);
  readonly changed = output<void>();

  readonly dialog = signal<DialogAction | null>(null);
  readonly label = signal<RmaLabel | null>(null);
  readonly passportComponents = signal<EquipmentComponent[]>([]);
  private pendingAction: RmaAction | null = null;

  readonly rma = this.store.rma;
  readonly actions = computed(() => {
    const rma = this.rma();
    return rma ? allowedRmaActions(rma.status) : [];
  });
  readonly loanerAllowed = computed(() => {
    const rma = this.rma();
    return !!rma && canIssueLoaner(rma);
  });
  readonly loanerOverdue = computed(() => isLoanerOverdue(this.rma()?.loaner));
  readonly currency = computed(() => this.rma()?.estimate.currency || 'EUR');

  readonly rmaStatusTag = rmaStatusTag;
  readonly warrantyStatusTag = warrantyStatusTag;
  readonly estimateApprovalTag = estimateApprovalTag;
  readonly loanerStatusTag = loanerStatusTag;
  readonly vendorClaimTag = vendorClaimTag;
  readonly rmaStatusLabelKey = rmaStatusLabelKey;
  readonly toAmount = toAmount;

  constructor() {
    effect(() => {
      const id = this.rmaId();
      const isOpen = this.open();
      untracked(() => {
        if (isOpen && id) {
          this.pendingAction = this.initialAction();
          this.dialog.set(null);
          this.store.open(id);
        }
      });
    });
    effect(() => {
      const rma = this.rma();
      untracked(() => {
        if (rma && this.pendingAction && this.actions().includes(this.pendingAction)) {
          const action = this.pendingAction;
          this.pendingAction = null;
          // Payload-less actions still need the explicit confirmation offered in the drawer.
          if (!this.needsConfirm(action)) {
            this.trigger(action);
          }
        }
      });
    });
  }

  close(): void {
    this.open.set(false);
    this.dialog.set(null);
    this.store.close();
  }

  /** Opens the dialog of an action or runs it directly when it has no payload. */
  trigger(action: RmaAction): void {
    switch (action) {
      case 'resend_estimate':
        void this.store.resendEstimate().then((res) => this.afterAction(res));
        return;
      case 'parts_received':
        void this.store.partsReceived().then((res) => this.afterAction(res));
        return;
      case 'close':
        void this.store.closeRma().then((res) => this.afterAction(res));
        return;
      case 'complete_repair':
        void this.loadPassportComponents();
        this.dialog.set('complete_repair');
        return;
      default:
        this.dialog.set(action);
    }
  }

  /** Popconfirm is used for payload-less actions; the rest open a dialog. */
  needsConfirm(action: RmaAction): boolean {
    return action === 'parts_received' || action === 'close' || action === 'resend_estimate';
  }

  isDialogOpen(action: DialogAction): boolean {
    return this.dialog() === action;
  }

  setDialogOpen(action: DialogAction, open: boolean): void {
    if (open) {
      this.dialog.set(action);
    } else if (this.dialog() === action) {
      this.dialog.set(null);
    }
  }

  afterAction(result: ActionResult<unknown>): void {
    if (result.ok || result.status === 409) {
      this.board?.load();
      this.changed.emit();
    }
  }

  async showLabel(): Promise<void> {
    const id = this.rma()?.id;
    if (!id) {
      return;
    }
    const res = await runRequest(this.api.getLabel(id));
    if (res.ok) {
      this.label.set(res.data.data);
    }
  }

  /** New tracking link: the previous one stops working; the raw token is revealed once. */
  async regenerateTracking(): Promise<void> {
    const id = this.rma()?.id;
    if (!id) {
      return;
    }
    const res = await runRequest(this.api.regenerateTrackingToken(id));
    if (res.ok) {
      this.notifier.success('RMA.MESSAGES.TRACKING_REGENERATED');
      this.label.set(res.data.data);
    }
  }

  private async loadPassportComponents(): Promise<void> {
    const passportId = this.rma()?.equipment_passport_id;
    this.passportComponents.set([]);
    if (!passportId) {
      return;
    }
    const res = await runRequest(this.api.getPassport(passportId));
    if (res.ok) {
      this.passportComponents.set((res.data.data.components ?? []).filter((c) => !c.removed_at));
    }
  }
}
