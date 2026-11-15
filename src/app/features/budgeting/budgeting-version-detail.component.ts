import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BudgetingApiService, BudgetVersion, TranslateService } from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { BudgetingDriversComponent } from './budgeting-drivers.component';
import { BudgetingLinesComponent } from './budgeting-lines.component';
import { BudgetingVarianceComponent } from './budgeting-variance.component';
import { apiErrorText, blankToNull, VERSION_STATUS_COLORS } from './budgeting.util';

export type BudgetApprovalStep = 'submit' | 'approve' | 'reject' | 'lock';

/** One budget version: lines, drivers, budget versus actual and the approval workflow. */
@Component({
  selector: 'app-budgeting-version-detail',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    BudgetingDriversComponent,
    BudgetingLinesComponent,
    BudgetingVarianceComponent,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="version()?.name ?? ''" [subtitle]="version()?.description ?? ''">
      <a nz-button routerLink="/budgeting/versions">{{ 'BUDGETING.BACK_TO_VERSIONS' | translate }}</a>
    </app-page-header>

    @if (version(); as current) {
      <div class="toolbar">
        <nz-tag [nzColor]="statusColor()">{{ ('BUDGETING.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
        <nz-tag>{{ ('BUDGETING.TYPE_' + current.version_type.toUpperCase()) | translate }}</nz-tag>
        <span class="muted">{{ 'BUDGETING.FISCAL_YEAR' | translate }} {{ current.fiscal_year }} ({{ current.year_start }})</span>
        <span class="muted">{{ 'BUDGETING.TOTAL_AMOUNT' | translate }}: {{ (current.total_amount ?? '0') | number: '1.2-2' }} {{ current.currency }}</span>
        <span class="spacer"></span>
        @if (current.status === 'draft') {
          <button nz-button nzType="primary" (click)="openStep('submit')">{{ 'BUDGETING.STEP_SUBMIT' | translate }}</button>
        }
        @if (current.status === 'submitted') {
          <button nz-button nzType="primary" (click)="openStep('approve')">{{ 'BUDGETING.STEP_APPROVE' | translate }}</button>
          <button nz-button nzDanger (click)="openStep('reject')">{{ 'BUDGETING.STEP_REJECT' | translate }}</button>
        }
        @if (current.status === 'approved') {
          <button nz-button nzType="primary" (click)="openStep('lock')">{{ 'BUDGETING.STEP_LOCK' | translate }}</button>
          <button nz-button nzDanger (click)="openStep('reject')">{{ 'BUDGETING.STEP_REJECT' | translate }}</button>
        }
      </div>

      <nz-tabs>
        <nz-tab [nzTitle]="'BUDGETING.TAB_LINES' | translate">
          <ng-template nzTabContent><app-budgeting-lines [versionId]="current.id" [editable]="editable()" (changed)="bump()"></app-budgeting-lines></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'BUDGETING.TAB_DRIVERS' | translate">
          <ng-template nzTabContent><app-budgeting-drivers [versionId]="current.id" [editable]="editable()" (changed)="bump()"></app-budgeting-drivers></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'BUDGETING.TAB_VARIANCE' | translate">
          <ng-template nzTabContent><app-budgeting-variance [versionId]="current.id" [refresh]="revision()"></app-budgeting-variance></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'BUDGETING.TAB_APPROVALS' | translate">
          <ng-template nzTabContent>
            <nz-card class="main-card">
              <nz-table #trail [nzData]="current.approvals ?? []" nzSize="small" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'BUDGETING.DATE' | translate }}</th>
                    <th>{{ 'BUDGETING.ACTION' | translate }}</th>
                    <th>{{ 'BUDGETING.STATUS' | translate }}</th>
                    <th>{{ 'BUDGETING.COMMENT' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of trail.data; track row.id) {
                    <tr>
                      <td>{{ row.created_at }}</td>
                      <td>{{ ('BUDGETING.STEP_' + row.action.toUpperCase()) | translate }}</td>
                      <td>{{ ('BUDGETING.STATUS_' + row.from_status.toUpperCase()) | translate }} &rarr; {{ ('BUDGETING.STATUS_' + row.to_status.toUpperCase()) | translate }}</td>
                      <td>{{ row.comment }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              @if ((current.approvals ?? []).length === 0) {
                <nz-empty [nzNotFoundContent]="'BUDGETING.NO_APPROVALS' | translate"></nz-empty>
              }
            </nz-card>
          </ng-template>
        </nz-tab>
      </nz-tabs>
    }

    <nz-modal [(nzVisible)]="stepVisible" [nzTitle]="stepTitle() | translate" (nzOnCancel)="stepVisible.set(false)" (nzOnOk)="runStep()" okAction="save" [nzOkDisabled]="step() === 'reject' && !stepForm.controls.comment.value.trim()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="stepForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label [nzRequired]="step() === 'reject'" nzFor="step-comment">{{ 'BUDGETING.COMMENT' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="step-comment" rows="3" formControlName="comment" maxlength="1000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingVersionDetailComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly version = signal<BudgetVersion | null>(null);
  readonly revision = signal(0);
  readonly stepVisible = signal(false);
  readonly step = signal<BudgetApprovalStep>('submit');
  readonly editable = computed(() => this.version()?.status === 'draft');
  readonly stepTitle = computed(() => `BUDGETING.STEP_${this.step().toUpperCase()}`);

  readonly stepForm = this.fb.group({ comment: [''] });

  ngOnInit(): void {
    this.reload();
  }

  statusColor(): string {
    return VERSION_STATUS_COLORS[this.version()?.status ?? 'draft'];
  }

  bump(): void {
    this.revision.update((value) => value + 1);
    this.reload();
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api.getVersion(id).subscribe({
      next: (response) => this.version.set(response.data),
      error: () => this.message.error(this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  openStep(step: BudgetApprovalStep): void {
    this.step.set(step);
    this.stepForm.reset({ comment: '' });
    this.stepVisible.set(true);
  }

  runStep(): void {
    const version = this.version();
    if (!version) {
      return;
    }

    const payload = { comment: blankToNull(this.stepForm.getRawValue().comment) };
    const request = {
      submit: () => this.api.submitVersion(version.id, payload),
      approve: () => this.api.approveVersion(version.id, payload),
      reject: () => this.api.rejectVersion(version.id, payload),
      lock: () => this.api.lockVersion(version.id, payload),
    }[this.step()]();

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.STEP_DONE'));
        this.stepVisible.set(false);
        this.bump();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
