import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PLM_APPROVAL_DEPARTMENTS,
  PlmApiService,
  PlmApprovalDepartment,
  PlmChangeOrder,
  PlmDecision,
  PlmDepartmentSignoff,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { APPROVAL_STATUS_COLORS, apiErrorText, CHANGE_STATUS_COLORS } from './plm.util';

/** One change order: reason, 4-department approvals matrix, stock disposition cutover, and ECN execution. */
@Component({
  selector: 'app-plm-change-order-detail',
  styleUrl: './plm.scss',
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (order(); as current) {
      <app-page-header [title]="current.code + ' - ' + current.title" [subtitle]="'PLM.DETAIL_SUBTITLE' | translate">
        <a nz-button routerLink="/plm">{{ 'PLM.BACK' | translate }}</a>
        @if (current.status === 'draft') {
          <button nz-button nzType="primary" (click)="submit()">{{ 'PLM.SUBMIT' | translate }}</button>
          <button nz-button nzDanger nz-popconfirm [nzPopconfirmTitle]="'PLM.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove()">{{ 'PLM.DELETE' | translate }}</button>
        }
        @if (current.status === 'in_review') {
          <button nz-button nzType="primary" (click)="openDecision('approve')">{{ 'PLM.APPROVE' | translate }}</button>
          <button nz-button nzDanger (click)="openDecision('reject')">{{ 'PLM.REJECT' | translate }}</button>
        }
        @if (current.status === 'approved') {
          <button nz-button nzType="primary" nz-popconfirm [nzPopconfirmTitle]="'PLM.IMPLEMENT_CONFIRM' | translate" (nzOnConfirm)="implement()">{{ 'PLM.IMPLEMENT' | translate }}</button>
          <button nz-button nzType="primary" (click)="executeCutover()">{{ 'PLM.EXECUTE_CUTOVER' | translate }}</button>
        }
        @if (current.status === 'draft' || current.status === 'in_review' || current.status === 'approved') {
          <button nz-button nz-popconfirm [nzPopconfirmTitle]="'PLM.CANCEL_CONFIRM' | translate" (nzOnConfirm)="cancel()">{{ 'PLM.CANCEL' | translate }}</button>
        }
      </app-page-header>

      @if (current.is_safety_immediate_cutover) {
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="'PLM.SAFETY_CUTOVER_BANNER' | translate"
          style="margin-bottom: 16px"
        ></nz-alert>
      }

      <nz-card class="main-card">
        <nz-descriptions nzSize="small" [nzColumn]="3">
          <nz-descriptions-item [nzTitle]="'PLM.STATUS' | translate">
            <nz-tag [nzColor]="statusColor(current.status)">{{ ('PLM.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.CHANGE_TYPE' | translate">{{ ('PLM.TYPE_' + current.change_type.toUpperCase()) | translate }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.PRIORITY' | translate">{{ ('PLM.PRIORITY_' + current.priority.toUpperCase()) | translate }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.EFFECTIVE_DATE' | translate">{{ current.effective_date ?? '' }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.IMPLEMENTED_AT' | translate">{{ current.implemented_at ?? '' }}</nz-descriptions-item>
          @if (current.ecn_number) {
            <nz-descriptions-item [nzTitle]="'PLM.ECN_NUMBER' | translate">{{ current.ecn_number }}</nz-descriptions-item>
          }
          <nz-descriptions-item [nzTitle]="'PLM.REASON' | translate" [nzSpan]="3">{{ current.reason }}</nz-descriptions-item>
          @if (current.rejection_reason) {
            <nz-descriptions-item [nzTitle]="'PLM.REJECTION_REASON' | translate" [nzSpan]="3">{{ current.rejection_reason }}</nz-descriptions-item>
          }
        </nz-descriptions>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.DEPT_APPROVAL_MATRIX' | translate">
        <nz-table [nzData]="departmentRows(current)" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.APPROVER' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th>{{ 'PLM.SIGN_OFF_HASH' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (dept of departmentRows(current); track dept.department) {
              <tr>
                <td>{{ ('PLM.DEPT_' + dept.department.toUpperCase()) | translate }}</td>
                <td>
                  <nz-tag [nzColor]="approvalColor(dept.status)">{{ ('PLM.APPROVAL_' + dept.status.toUpperCase()) | translate }}</nz-tag>
                </td>
                <td><code>{{ dept.sign_off_hash ?? '-' }}</code></td>
                <td>
                  @if (current.status === 'draft' || current.status === 'in_review') {
                    <button nz-button nzSize="small" type="button" (click)="signoffDepartment(dept.department, 'approve')">{{ 'PLM.APPROVE' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.APPROVAL_FLOW' | translate">
        <nz-table #approvalTable [nzData]="current.approvals ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ 'PLM.APPROVER' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th>{{ 'PLM.DECIDED_AT' | translate }}</th>
              <th>{{ 'PLM.COMMENT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of approvalTable.data; track row.id) {
              <tr>
                <td>{{ row.sequence }}</td>
                <td>{{ row.approver_name }}</td>
                <td>
                  <nz-tag [nzColor]="approvalColor(row.status)">{{ ('PLM.APPROVAL_' + row.status.toUpperCase()) | translate }}</nz-tag>
                </td>
                <td>{{ row.decided_at ?? '' }}</td>
                <td>{{ row.comment }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if ((current.approvals ?? []).length === 0) {
          <nz-empty [nzNotFoundContent]="'PLM.NO_APPROVERS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.AFFECTED_ITEMS' | translate">
        <nz-table #itemTable [nzData]="current.affected_items ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.TO_REVISION' | translate }}</th>
              <th>{{ 'PLM.CHANGE_SUMMARY' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of itemTable.data; track row.id) {
              <tr>
                <td>{{ row.item_code }} {{ row.item_name }}</td>
                <td>{{ row.to_revision }}</td>
                <td>{{ row.change_summary }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if ((current.affected_items ?? []).length === 0) {
          <nz-empty [nzNotFoundContent]="'PLM.NO_AFFECTED_ITEMS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.AFFECTED_BOMS' | translate">
        <nz-table #bomTable [nzData]="current.affected_boms ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.BOM' | translate }}</th>
              <th>{{ 'PLM.BOM_REVISION' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th>{{ 'PLM.NOTE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of bomTable.data; track row.id) {
              <tr>
                <td>{{ row.bom_number }} {{ row.bom_name }}</td>
                <td>{{ row.bom_revision }}</td>
                <td>{{ row.bom_status }}</td>
                <td>{{ row.note }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if ((current.affected_boms ?? []).length === 0) {
          <nz-empty [nzNotFoundContent]="'PLM.NO_AFFECTED_BOMS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-modal [(nzVisible)]="decisionVisible" [nzTitle]="(decision() === 'approve' ? 'PLM.APPROVE' : 'PLM.REJECT') | translate" (nzOnCancel)="decisionVisible.set(false)" (nzOnOk)="decide()">
        <ng-container *nzModalContent>
          <label for="plm-comment">{{ 'PLM.COMMENT' | translate }}</label>
          <textarea nz-input id="plm-comment" rows="3" maxlength="2000" [ngModel]="comment()" (ngModelChange)="comment.set($event)"></textarea>
        </ng-container>
      </nz-modal>
    }
  `,
})
export class PlmChangeOrderDetailComponent implements OnInit {
  private readonly api = inject(PlmApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly order = signal<PlmChangeOrder | null>(null);
  readonly decisionVisible = signal(false);
  readonly decision = signal<PlmDecision>('approve');
  readonly comment = signal('');

  private get orderId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: string): string {
    return CHANGE_STATUS_COLORS[status] ?? 'default';
  }

  approvalColor(status: string): string {
    return APPROVAL_STATUS_COLORS[status] ?? 'default';
  }

  departmentRows(current: PlmChangeOrder): PlmDepartmentSignoff[] {
    const matrix = current.approvals_matrix_json ?? {};
    return PLM_APPROVAL_DEPARTMENTS.map(
      (department) =>
        matrix[department] ?? {
          department,
          status: 'pending',
          actor_id: null,
          decided_at: null,
          sign_off_hash: null,
        },
    );
  }

  load(): void {
    this.api.getChangeOrder(this.orderId).subscribe({ next: (response) => this.order.set(response.data), error: (error: unknown) => this.fail(error) });
  }

  submit(): void {
    this.run(this.api.submitChangeOrder(this.orderId), 'PLM.SUBMITTED');
  }

  cancel(): void {
    this.run(this.api.cancelChangeOrder(this.orderId), 'PLM.CANCELLED');
  }

  implement(): void {
    this.run(this.api.implementChangeOrder(this.orderId), 'PLM.IMPLEMENTED');
  }

  executeCutover(): void {
    this.run(this.api.executeCutover(this.orderId), 'PLM.CUTOVER_DONE');
  }

  signoffDepartment(department: PlmApprovalDepartment, decision: PlmDecision): void {
    this.run(this.api.recordDepartmentSignoff(this.orderId, { department, decision }), 'PLM.SIGNOFF_RECORDED');
  }

  remove(): void {
    this.api.deleteChangeOrder(this.orderId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLM.DELETED'));
        this.order.set(null);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openDecision(decision: PlmDecision): void {
    this.decision.set(decision);
    this.comment.set('');
    this.decisionVisible.set(true);
  }

  decide(): void {
    const comment = this.comment().trim();
    this.api.decideChangeOrder(this.orderId, { decision: this.decision(), comment: comment === '' ? null : comment }).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('PLM.DECIDED'));
        this.decisionVisible.set(false);
        this.order.set(response.data);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private run(request: ReturnType<PlmApiService['submitChangeOrder']>, successKey: string): void {
    request.subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(successKey));
        this.order.set(response.data);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('PLM.ACTION_ERROR'));
  }
}
