import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DmsApiService,
  DmsApprovalRequestResource,
  DmsApprovalStatus,
  DmsApprovalStep,
  DmsApprovalTemplateResource,
  DmsPreservationChainStatus,
  DmsPreservationChainVerification,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

const STATUS_COLORS: Record<DmsApprovalStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
};

/**
 * Document approvals (templates and requests with the decision of the current step) and the legal preservation
 * hash chain (retention and sealing status, anchoring, verification).
 */
@Component({
  selector: 'app-dms-workflows',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './dms-workflows.component.html',
})
export class DmsWorkflowsComponent implements OnInit {
  private readonly api = inject(DmsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly requests = signal<DmsApprovalRequestResource[]>([]);
  protected readonly templates = signal<DmsApprovalTemplateResource[]>([]);
  protected readonly chainStatus = signal<DmsPreservationChainStatus | null>(null);
  protected readonly verification = signal<DmsPreservationChainVerification | null>(null);
  protected readonly awaitingMe = signal(true);
  protected readonly loading = signal(false);

  protected readonly rejectTarget = signal<DmsApprovalRequestResource | null>(null);
  protected rejectComment = '';

  protected readonly templateModalVisible = signal(false);
  protected templateName = '';
  protected readonly templateSteps = signal<DmsApprovalStep[]>([]);
  protected readonly savingTemplate = signal(false);

  ngOnInit(): void {
    this.loadRequests();
    this.loadTemplates();
    this.loadChain();
  }

  protected statusColor(status: DmsApprovalStatus): string {
    return STATUS_COLORS[status];
  }

  protected loadRequests(): void {
    this.loading.set(true);
    this.api.getApprovalRequests(this.awaitingMe() ? { awaiting_me: true } : {}).subscribe({
      next: (response) => {
        this.requests.set(response.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggleAwaitingMe(value: boolean): void {
    this.awaitingMe.set(value);
    this.loadRequests();
  }

  protected approve(request: DmsApprovalRequestResource): void {
    this.api.approveApprovalRequest(request.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS_WORKFLOWS.MSG_APPROVED'));
        this.loadRequests();
      },
      error: () => this.message.error(this.translate.instant('DMS_WORKFLOWS.MSG_FAILED')),
    });
  }

  protected openReject(request: DmsApprovalRequestResource): void {
    this.rejectComment = '';
    this.rejectTarget.set(request);
  }

  protected confirmReject(): void {
    const target = this.rejectTarget();
    if (target === null || this.rejectComment.trim() === '') {
      return;
    }
    this.api.rejectApprovalRequest(target.id, this.rejectComment.trim()).subscribe({
      next: () => {
        this.rejectTarget.set(null);
        this.message.success(this.translate.instant('DMS_WORKFLOWS.MSG_REJECTED'));
        this.loadRequests();
      },
      error: () => this.message.error(this.translate.instant('DMS_WORKFLOWS.MSG_FAILED')),
    });
  }

  protected cancel(request: DmsApprovalRequestResource): void {
    this.api.cancelApprovalRequest(request.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('DMS_WORKFLOWS.MSG_CANCELLED'));
        this.loadRequests();
      },
      error: () => this.message.error(this.translate.instant('DMS_WORKFLOWS.MSG_FAILED')),
    });
  }

  protected loadTemplates(): void {
    this.api.getApprovalTemplates().subscribe({ next: (response) => this.templates.set(response.data) });
  }

  protected openTemplateModal(): void {
    this.templateName = '';
    this.templateSteps.set([{ name: '', approver_type: 'role', approver_role: '' }]);
    this.templateModalVisible.set(true);
  }

  protected addStep(): void {
    this.templateSteps.update((steps) => [...steps, { name: '', approver_type: 'role', approver_role: '' }]);
  }

  protected removeStep(index: number): void {
    this.templateSteps.update((steps) => steps.filter((_, position) => position !== index));
  }

  protected updateStep(index: number, patch: Partial<DmsApprovalStep>): void {
    this.templateSteps.update((steps) => steps.map((step, position) => (position === index ? { ...step, ...patch } : step)));
  }

  protected canSaveTemplate(): boolean {
    const steps = this.templateSteps();
    return (
      this.templateName.trim() !== '' &&
      steps.length > 0 &&
      steps.every(
        (step) =>
          step.name.trim() !== '' &&
          (step.approver_type === 'role' ? (step.approver_role ?? '').trim() !== '' : (step.approver_user_id ?? '').trim() !== ''),
      )
    );
  }

  protected saveTemplate(): void {
    if (!this.canSaveTemplate()) {
      return;
    }
    this.savingTemplate.set(true);
    this.api.createApprovalTemplate({ name: this.templateName.trim(), steps: this.templateSteps() }).subscribe({
      next: () => {
        this.savingTemplate.set(false);
        this.templateModalVisible.set(false);
        this.message.success(this.translate.instant('DMS_WORKFLOWS.MSG_TEMPLATE_SAVED'));
        this.loadTemplates();
      },
      error: () => {
        this.savingTemplate.set(false);
        this.message.error(this.translate.instant('DMS_WORKFLOWS.MSG_FAILED'));
      },
    });
  }

  protected deleteTemplate(template: DmsApprovalTemplateResource): void {
    this.api.deleteApprovalTemplate(template.id).subscribe({
      next: () => this.loadTemplates(),
      error: () => this.message.error(this.translate.instant('DMS_WORKFLOWS.MSG_FAILED')),
    });
  }

  protected loadChain(): void {
    this.api.getPreservationChainStatus().subscribe({ next: (response) => this.chainStatus.set(response.data) });
  }

  protected anchorChain(): void {
    this.api.anchorPreservationChain().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('DMS_WORKFLOWS.MSG_ANCHORED', { count: response.data.length }));
        this.loadChain();
      },
      error: () => this.message.error(this.translate.instant('DMS_WORKFLOWS.MSG_FAILED')),
    });
  }

  protected verifyChain(): void {
    this.api.verifyPreservationChain().subscribe({ next: (response) => this.verification.set(response.data) });
  }
}
