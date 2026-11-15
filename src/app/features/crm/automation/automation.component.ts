import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CRM_AUTOMATION_EXIT_CONDITIONS,
  CRM_AUTOMATION_STEP_TYPES,
  CRM_AUTOMATION_TRIGGERS,
  CrmAutomationEnrollment,
  CrmAutomationEntity,
  CrmAutomationExitCondition,
  CrmAutomationSequence,
  CrmAutomationStep,
  CrmAutomationStepLog,
  CrmAutomationTrigger,
  CrmExtensionApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';

/** Marketing automation: sequences of steps, their enrolments with the exit conditions and the step execution log. */
@Component({
  selector: 'app-crm-automation',
  imports: [
    FormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CRMEXT.AUTOMATION.TITLE' | translate" [subtitle]="'CRMEXT.AUTOMATION.SUBTITLE' | translate">
      @if (canWrite()) {
        <button nz-button type="button" (click)="runDue()">{{ 'CRMEXT.AUTOMATION.RUN_DUE' | translate }}</button>
        <button nz-button nzType="primary" type="button" appIconAction="create" (click)="openModal()"></button>
      }
    </app-page-header>

    <nz-card>
      <nz-table [nzData]="sequences()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'CRMEXT.COMMON.NAME' | translate }}</th>
            <th>{{ 'CRMEXT.AUTOMATION.TRIGGER' | translate }}</th>
            <th>{{ 'CRMEXT.AUTOMATION.STEPS' | translate }}</th>
            <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (sequence of sequences(); track sequence.id) {
            <tr>
              <td>{{ sequence.name }}</td>
              <td>{{ 'CRMEXT.AUTOMATION.TRIGGER_' + sequence.trigger_type | translate }}</td>
              <td>{{ sequence.steps?.length ?? 0 }}</td>
              <td><nz-tag [nzColor]="sequence.is_active ? 'green' : 'default'">{{ (sequence.is_active ? 'CRMEXT.COMMON.ACTIVE' : 'CRMEXT.COMMON.INACTIVE') | translate }}</nz-tag></td>
              <td>
                <button nz-button nzType="text" nzSize="small" type="button" (click)="showEnrollments(sequence)">{{ 'CRMEXT.AUTOMATION.ENROLLMENTS' | translate }}</button>
                @if (canWrite()) {
                  <button nz-button nzType="text" nzDanger nzSize="small" type="button" appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CRMEXT.COMMON.CONFIRM_DELETE' | translate" (nzOnConfirm)="remove(sequence)"></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (selected(); as sequence) {
      <nz-card class="enrollments" [nzTitle]="sequence.name">
        <nz-table [nzData]="enrollments()" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'CRMEXT.AUTOMATION.SUBJECT' | translate }}</th>
              <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
              <th>{{ 'CRMEXT.AUTOMATION.NEXT_RUN' | translate }}</th>
              <th>{{ 'CRMEXT.AUTOMATION.EXIT_REASON' | translate }}</th>
              <th>{{ 'COMMON.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (enrollment of enrollments(); track enrollment.id) {
              <tr>
                <td>{{ enrollment.lead_id ?? enrollment.contact_id }}</td>
                <td><nz-tag>{{ 'CRMEXT.AUTOMATION.STATUS_' + enrollment.status | translate }}</nz-tag></td>
                <td>{{ enrollment.next_run_at }}</td>
                <td>{{ enrollment.exit_reason }}</td>
                <td>
                  <button nz-button nzType="text" nzSize="small" type="button" (click)="showLogs(enrollment)">{{ 'CRMEXT.AUTOMATION.LOG' | translate }}</button>
                  @if (canWrite() && enrollment.status === 'active') {
                    <button nz-button nzType="text" nzDanger nzSize="small" type="button" (click)="exitEnrollment(enrollment)">{{ 'CRMEXT.AUTOMATION.EXIT' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (logs().length > 0) {
          <nz-table [nzData]="logs()" [nzFrontPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.AUTOMATION.STEP' | translate }}</th>
                <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
                <th>{{ 'CRMEXT.AUTOMATION.MESSAGE' | translate }}</th>
                <th>{{ 'CRMEXT.AUTOMATION.EXECUTED_AT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs(); track log.id) {
                <tr>
                  <td>{{ log.position }} ({{ 'CRMEXT.AUTOMATION.STEP_' + log.step_type | translate }})</td>
                  <td>{{ log.status }}</td>
                  <td>{{ log.message }}</td>
                  <td>{{ log.executed_at }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-card>
    }

    <nz-modal okAction="save" [nzVisible]="modalOpen()" [nzTitle]="'CRMEXT.AUTOMATION.NEW' | translate" nzWidth="720px" [nzOkLoading]="saving()" [nzOkDisabled]="!valid()" (nzOnCancel)="modalOpen.set(false)" (nzOnOk)="save()">
      <ng-container *nzModalContent>
        <label for="seq-name">{{ 'CRMEXT.COMMON.NAME' | translate }}</label>
        <input nz-input id="seq-name" maxlength="150" [(ngModel)]="name" />
        <label for="seq-entity">{{ 'CRMEXT.AUTOMATION.ENTITY' | translate }}</label>
        <nz-select nzId="seq-entity" [(ngModel)]="entity">
          <nz-option nzValue="leads" [nzLabel]="'CRMEXT.AUTOMATION.ENTITY_leads' | translate"></nz-option>
          <nz-option nzValue="contacts" [nzLabel]="'CRMEXT.AUTOMATION.ENTITY_contacts' | translate"></nz-option>
        </nz-select>
        <label for="seq-trigger">{{ 'CRMEXT.AUTOMATION.TRIGGER' | translate }}</label>
        <nz-select nzId="seq-trigger" [(ngModel)]="trigger">
          @for (value of triggers; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'CRMEXT.AUTOMATION.TRIGGER_' + value | translate"></nz-option>
          }
        </nz-select>
        <label for="seq-exit">{{ 'CRMEXT.AUTOMATION.EXIT_CONDITIONS' | translate }}</label>
        <nz-select nzId="seq-exit" nzMode="multiple" [(ngModel)]="exitConditions">
          @for (value of exitOptions; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'CRMEXT.AUTOMATION.EXIT_' + value | translate"></nz-option>
          }
        </nz-select>
        <h4>{{ 'CRMEXT.AUTOMATION.STEPS' | translate }}</h4>
        @for (step of steps; track $index; let i = $index) {
          <div class="step-row">
            <nz-select [attr.aria-label]="'CRMEXT.AUTOMATION.STEP' | translate" [(ngModel)]="step.step_type">
              @for (type of stepTypes; track type) {
                <nz-option [nzValue]="type" [nzLabel]="'CRMEXT.AUTOMATION.STEP_' + type | translate"></nz-option>
              }
            </nz-select>
            <input nz-input type="number" min="0" max="365" [attr.aria-label]="'CRMEXT.AUTOMATION.DELAY_DAYS' | translate" [placeholder]="'CRMEXT.AUTOMATION.DELAY_DAYS' | translate" [(ngModel)]="step.delay_days" />
            @if (step.step_type !== 'wait') {
              <input nz-input maxlength="200" [attr.aria-label]="'CRMEXT.AUTOMATION.SUBJECT_LINE' | translate" [placeholder]="'CRMEXT.AUTOMATION.SUBJECT_LINE' | translate" [(ngModel)]="step.subject" />
            }
            @if (step.step_type === 'email') {
              <input nz-input [attr.aria-label]="'CRMEXT.AUTOMATION.BODY' | translate" [placeholder]="'CRMEXT.AUTOMATION.BODY' | translate" [(ngModel)]="step.body" />
            }
            <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" (click)="removeStep(i)"></button>
          </div>
        }
        <button nz-button nzType="dashed" type="button" appIconAction="add" (click)="addStep()"></button>
      </ng-container>
    </nz-modal>
  `,
})
export class AutomationComponent {
  private readonly api = inject(CrmExtensionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly sequences = signal<CrmAutomationSequence[]>([]);
  protected readonly selected = signal<CrmAutomationSequence | null>(null);
  protected readonly enrollments = signal<CrmAutomationEnrollment[]>([]);
  protected readonly logs = signal<CrmAutomationStepLog[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly triggers = CRM_AUTOMATION_TRIGGERS;
  protected readonly exitOptions = CRM_AUTOMATION_EXIT_CONDITIONS;
  protected readonly stepTypes = CRM_AUTOMATION_STEP_TYPES;
  protected name = '';
  protected entity: CrmAutomationEntity = 'leads';
  protected trigger: CrmAutomationTrigger = 'manual';
  protected exitConditions: CrmAutomationExitCondition[] = ['lead_converted', 'consent_withdrawn'];
  protected steps: CrmAutomationStep[] = [];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getAutomationSequences().subscribe({
      next: (res) => {
        this.sequences.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openModal(): void {
    this.name = '';
    this.entity = 'leads';
    this.trigger = 'manual';
    this.exitConditions = ['lead_converted', 'consent_withdrawn'];
    this.steps = [{ step_type: 'email', delay_days: 0, subject: '', body: '' }];
    this.modalOpen.set(true);
  }

  protected addStep(): void {
    this.steps = [...this.steps, { step_type: 'email', delay_days: 1, subject: '', body: '' }];
  }

  protected removeStep(index: number): void {
    this.steps = this.steps.filter((_, i) => i !== index);
  }

  protected valid(): boolean {
    return (
      this.name.trim().length > 0 &&
      this.steps.length > 0 &&
      this.steps.every((step) => step.step_type !== 'email' || ((step.subject ?? '').trim().length > 0 && (step.body ?? '').trim().length > 0))
    );
  }

  protected save(): void {
    this.saving.set(true);
    this.api
      .createAutomationSequence({
        name: this.name.trim(),
        entity: this.entity,
        trigger_type: this.trigger,
        exit_conditions: this.exitConditions,
        steps: this.steps.map((step) => ({
          step_type: step.step_type,
          delay_days: Number(step.delay_days) || 0,
          subject: step.step_type === 'wait' ? null : step.subject || null,
          body: step.step_type === 'email' ? step.body || null : null,
        })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.message.success(this.i18n.translate('CRMEXT.COMMON.SAVED'));
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  protected remove(sequence: CrmAutomationSequence): void {
    this.api.deleteAutomationSequence(sequence.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMEXT.COMMON.DELETED'));
        this.load();
      },
    });
  }

  protected showEnrollments(sequence: CrmAutomationSequence): void {
    this.selected.set(sequence);
    this.logs.set([]);
    this.api.getAutomationEnrollments(sequence.id).subscribe({ next: (res) => this.enrollments.set(res.data ?? []) });
  }

  protected showLogs(enrollment: CrmAutomationEnrollment): void {
    this.api.getAutomationStepLogs(enrollment.id).subscribe({ next: (res) => this.logs.set(res.data ?? []) });
  }

  protected exitEnrollment(enrollment: CrmAutomationEnrollment): void {
    this.api.exitAutomationEnrollment(enrollment.id).subscribe({
      next: () => {
        const sequence = this.selected();
        if (sequence !== null) {
          this.showEnrollments(sequence);
        }
      },
    });
  }

  protected runDue(): void {
    this.api.runAutomation().subscribe({
      next: (res) => {
        this.message.success(this.i18n.translate('CRMEXT.AUTOMATION.RUN_DONE', { handled: res.data.handled }));
        const sequence = this.selected();
        if (sequence !== null) {
          this.showEnrollments(sequence);
        }
      },
    });
  }
}
